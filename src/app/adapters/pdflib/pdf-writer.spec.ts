// @vitest-environment node
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } from 'pdf-lib';
import { vi } from 'vitest';

import { TUNABLES } from '../../../config/tunables';
import { HAS_QPDF, encrypted, fixture, qpdfCheck } from '../../../testing/pdf-fixtures';
import type { InkToAdd, PdfEdits } from '../../ports/pdf-writer';
import { err, ok } from '../../ports/result';
import { createPdfWriterApi } from './pdf-writer-api';
import type { PdfWriterWorkerApi } from './pdf-writer-worker-api';
import { PdfLibWriter } from './pdflib-pdf-writer';

const KEY = TUNABLES.saving.metadataFileName;

const api = createPdfWriterApi();
const noEdits: PdfEdits = { addInk: [], removeInk: [], embeddedJson: null };

async function apply(bytes: Uint8Array, edits: Partial<PdfEdits>): Promise<Uint8Array> {
  const result = await api.apply(bytes, { ...noEdits, ...edits }, KEY, 0);
  if (!result.ok) {
    throw new Error(`apply failed: ${result.error} ${result.detail ?? ''}`);
  }
  qpdfCheck(result.value);
  return result.value;
}

function ink(id: string, patch: Partial<InkToAdd> = {}): InkToAdd {
  return {
    pageIndex: 0,
    strokeId: id,
    points: [{ x: 100, y: 200 }, { x: 150.5, y: 260 }, { x: 180, y: 240.25 }],
    color: '#FF0000',
    widthPt: 2,
    opacity: 1,
    multiply: false,
    ...patch,
  };
}

const n = (s: string): PDFName => PDFName.of(s);

async function annotsOf(bytes: Uint8Array, pageIndex = 0): Promise<PDFDict[]> {
  const doc = await PDFDocument.load(bytes);
  const annots = doc.getPages()[pageIndex]?.node.lookupMaybe(n('Annots'), PDFArray);
  const out: PDFDict[] = [];
  for (let i = 0; annots && i < annots.size(); i++) {
    out.push(annots.lookup(i, PDFDict));
  }
  return out;
}

/** A one-page PDF with a foreign ink annotation without /NM, a /Text annotation and a foreign attachment. */
async function foreignPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const { context } = doc;
  const foreignInk = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Ink',
      Rect: [0, 0, 100, 100],
      InkList: [[10, 10, 20, 20], [30, 30]],
      C: [0, 0, 1],
      Border: [0, 0, 3],
      CA: 0.5,
    }),
  );
  const text = context.register(context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [5, 5, 25, 25], Contents: PDFString.of('note') }));
  page.node.set(n('Annots'), context.obj([foreignInk, text]));
  await doc.attach(new TextEncoder().encode('foreign'), 'foreign.txt', { mimeType: 'text/plain' });
  return doc.save({ useObjectStreams: false });
}

function fakeSpec(doc: PDFDocument, fileName: string): PDFRef {
  const { context } = doc;
  const stream = context.register(context.stream(fileName));
  return context.register(context.obj({ Type: 'Filespec', F: PDFString.of(fileName), EF: { F: stream } }));
}

/** A name tree with /Kids: one leaf per list of file names. */
async function kidsPdf(leaves: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  const { context } = doc;
  const kids = leaves.map((names) =>
    context.register(
      context.obj({
        Limits: [PDFString.of(names[0] as string), PDFString.of(names[names.length - 1] as string)],
        Names: names.flatMap((fileName) => [PDFString.of(fileName), fakeSpec(doc, fileName)]),
      }),
    ),
  );
  doc.catalog.set(n('Names'), context.obj({ EmbeddedFiles: { Kids: kids } }));
  return doc.save({ useObjectStreams: false });
}

/** The keys of all leaves of the /EmbeddedFiles tree, per leaf. */
async function leavesOf(bytes: Uint8Array): Promise<string[][]> {
  const doc = await PDFDocument.load(bytes);
  const root = doc.catalog.lookup(n('Names'), PDFDict).lookup(n('EmbeddedFiles'), PDFDict);
  const kids = root.lookupMaybe(n('Kids'), PDFArray);
  const leaves = kids ? Array.from({ length: kids.size() }, (_, i) => kids.lookup(i, PDFDict)) : [root];
  return leaves.map((leaf) => {
    const names = leaf.lookup(n('Names'), PDFArray);
    return Array.from({ length: names.size() / 2 }, (_, i) => (names.lookup(i * 2) as PDFString).decodeText());
  });
}

describe('PdfWriter: ink (M15 S2)', () => {
  it('SAV-006 adds two strokes as /Ink annotations with an appearance stream', async () => {
    const out = await apply(fixture('synthetic-score.pdf'), { addInk: [ink('a'), ink('b', { color: '#00FF00', widthPt: 4 })] });
    const annots = await annotsOf(out);
    expect(annots).toHaveLength(2);
    const first = annots[0] as PDFDict;
    expect(first.lookup(n('Subtype'), PDFName).toString()).toBe('/Ink');
    expect((first.lookup(n('NM'), PDFString)).decodeText()).toBe('a');
    expect(first.lookup(n('InkList'), PDFArray).lookup(0, PDFArray).asArray().map((v) => (v as PDFNumber).asNumber())).toEqual([
      100, 200, 150.5, 260, 180, 240.25,
    ]);
    expect(first.lookup(n('Rect'), PDFArray).asArray().map((v) => (v as PDFNumber).asNumber())).toEqual([98, 198, 182, 262]);
    expect(first.lookup(n('F'), PDFNumber).asNumber()).toBe(TUNABLES.pdfWriter.annotationFlags);
    const stream = first.lookup(n('AP'), PDFDict).lookup(n('N')) as PDFRawStream;
    const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    expect(content).toBe('q\n1 0 0 RG\n2 w\n1 J 1 j\n100 200 m\n150.5 260 l\n180 240.25 l\nS\nQ');
  });

  it('SAV-006 a single point is a zero-length line; highlighter strokes get a multiply graphics state', async () => {
    const out = await apply(fixture('synthetic-score.pdf'), {
      addInk: [ink('dot', { points: [{ x: 10, y: 20 }] }), ink('hl', { opacity: 0.35, multiply: true })],
    });
    const [dot, highlighter] = await annotsOf(out);
    const content = (annotation: PDFDict | undefined): string =>
      new TextDecoder().decode(decodePDFRawStream((annotation as PDFDict).lookup(n('AP'), PDFDict).lookup(n('N')) as PDFRawStream).decode());
    expect(content(dot)).toContain('10 20 m\n10 20 l');
    expect(content(dot)).not.toContain('gs');
    expect(content(highlighter)).toContain('/GS gs');
    const resources = ((highlighter as PDFDict).lookup(n('AP'), PDFDict).lookup(n('N')) as PDFRawStream).dict.lookup(n('Resources'), PDFDict);
    const gs = resources.lookup(n('ExtGState'), PDFDict).lookup(n('GS'), PDFDict);
    expect(gs.lookup(n('BM'), PDFName).toString()).toBe('/Multiply');
    expect(gs.lookup(n('CA'), PDFNumber).asNumber()).toBe(0.35);
    expect(gs.lookup(n('ca'), PDFNumber).asNumber()).toBe(0.35);
  });

  it('ANN-005 listInk returns the strokes written by apply, with nm: references', async () => {
    const out = await apply(fixture('synthetic-score.pdf'), { addInk: [ink('a'), ink('b', { color: '#00FF00', widthPt: 4, opacity: 0.5 })] });
    const listed = await api.listInk(out);
    expect(listed).toEqual(
      ok([
        { pageIndex: 0, annotationRef: 'nm:a', strokeId: 'a', points: ink('a').points, color: '#ff0000', widthPt: 2, opacity: 1 },
        { pageIndex: 0, annotationRef: 'nm:b', strokeId: 'b', points: ink('b').points, color: '#00ff00', widthPt: 4, opacity: 0.5 },
      ]),
    );
  });

  it('SAV-006 removes a stroke by nm: reference and deletes its objects', async () => {
    const withTwo = await apply(fixture('synthetic-score.pdf'), { addInk: [ink('a'), ink('b')] });
    const out = await apply(withTwo, { removeInk: [{ pageIndex: 0, annotationRef: 'nm:a' }] });
    const listed = await api.listInk(out);
    expect(listed.ok && listed.value.map((i) => i.strokeId)).toEqual(['b']);
    const objects = async (bytes: Uint8Array): Promise<number> => (await PDFDocument.load(bytes)).context.enumerateIndirectObjects().length;
    expect(await objects(out)).toBeLessThan(await objects(withTwo));
  });

  it('ANN-005 a foreign ink annotation has an obj: reference, decoded color and width, and can be removed', async () => {
    const bytes = await foreignPdf();
    const listed = await api.listInk(bytes);
    expect(listed.ok).toBe(true);
    const [foreign] = listed.ok ? listed.value : [];
    expect(foreign).toMatchObject({
      strokeId: null,
      color: '#0000ff',
      widthPt: 3,
      opacity: 0.5,
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }],
    });
    expect(foreign?.annotationRef).toMatch(/^obj:\d+$/);
    const out = await apply(bytes, { removeInk: [{ pageIndex: 0, annotationRef: foreign?.annotationRef ?? '' }] });
    expect(await api.listInk(out)).toEqual(ok([]));
    expect((await annotsOf(out)).map((a) => a.lookup(n('Subtype'), PDFName).toString())).toEqual(['/Text']);
  });

  it('SAV-006 gray and CMYK colors become hex; width falls back to /BS, /Border and 1', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage();
    const { context } = doc;
    const make = (extra: Record<string, unknown>): PDFRef =>
      context.register(context.obj({ Type: 'Annot', Subtype: 'Ink', Rect: [0, 0, 1, 1], InkList: [[1, 2]], ...extra } as never));
    page.node.set(n('Annots'), context.obj([make({ C: [0.5], BS: { W: 6 } }), make({ C: [0, 0, 0, 1] }), make({})]));
    const listed = await api.listInk(await doc.save());
    const items = listed.ok ? listed.value : [];
    expect(items.map((i) => [i.color, i.widthPt])).toEqual([['#808080', 6], ['#000000', 1], ['#000000', 1]]);
  });
});

describe('PdfWriter: everything else is preserved (SAV-013)', () => {
  it('SAV-013 foreign annotations, attachments and the document information survive', async () => {
    const source = await PDFDocument.load(await foreignPdf());
    source.setTitle('Keep me');
    const bytes = await source.save({ useObjectStreams: false });
    const out = await apply(bytes, { addInk: [ink('x')], embeddedJson: '{"a":1}' });
    expect((await annotsOf(out)).map((a) => a.lookup(n('Subtype'), PDFName).toString())).toEqual(['/Ink', '/Text', '/Ink']);
    expect((await PDFDocument.load(out)).getTitle()).toBe('Keep me');
    expect((await PDFDocument.load(out, { updateMetadata: false })).context.enumerateIndirectObjects().length).toBeGreaterThan(0);
    const keys = (await leavesOf(out)).flat();
    expect(keys).toEqual(['codexmusicae.json', 'foreign.txt']);
  });

  it('SAV-013 does not modify the input bytes', async () => {
    const bytes = fixture('synthetic-score.pdf');
    const copy = bytes.slice();
    await apply(bytes, { addInk: [ink('a')], embeddedJson: '{}' });
    expect(bytes).toEqual(copy);
  });
});

describe('PdfWriter: embedded JSON (M15 S2)', () => {
  it('SAV-001 writes the text, reads it back identically, and writing again keeps exactly one entry', async () => {
    const text = '{"schemaVersion":1,"name":"Fuge in g — ♭"}';
    const first = await apply(fixture('synthetic-score.pdf'), { embeddedJson: text });
    expect(await api.readEmbeddedJson(first, KEY)).toEqual(ok(text));
    const second = await apply(first, { embeddedJson: '{"v":2}' });
    expect(await api.readEmbeddedJson(second, KEY)).toEqual(ok('{"v":2}'));
    expect((await leavesOf(second)).flat()).toEqual([KEY]);
    const objects = async (bytes: Uint8Array): Promise<number> => (await PDFDocument.load(bytes)).context.enumerateIndirectObjects().length;
    expect(await objects(second)).toBe(await objects(first));
  });

  it('SAV-001 a file without the attachment reads as null, and null edits leave an existing attachment alone', async () => {
    expect(await api.readEmbeddedJson(fixture('synthetic-score.pdf'), KEY)).toEqual(ok(null));
    const withJson = await apply(fixture('synthetic-score.pdf'), { embeddedJson: '{"keep":true}' });
    const out = await apply(withJson, { addInk: [ink('a')] });
    expect(await api.readEmbeddedJson(out, KEY)).toEqual(ok('{"keep":true}'));
  });

  it('SAV-010 the entry is stored with the embedded-file stream and filespec fields', async () => {
    const out = await apply(fixture('synthetic-score.pdf'), { embeddedJson: '{"a":1}' });
    const doc = await PDFDocument.load(out);
    const tree = doc.catalog.lookup(n('Names'), PDFDict).lookup(n('EmbeddedFiles'), PDFDict).lookup(n('Names'), PDFArray);
    const spec = tree.lookup(1, PDFDict);
    expect(spec.lookup(n('Type'), PDFName).toString()).toBe('/Filespec');
    expect(spec.lookup(n('AFRelationship'), PDFName).toString()).toBe('/Data');
    const stream = spec.lookup(n('EF'), PDFDict).lookup(n('F')) as PDFRawStream;
    expect(stream.dict.lookup(n('Subtype'), PDFName).toString()).toBe('/application#2Fjson');
    expect(stream.dict.lookup(n('Params'), PDFDict).lookup(n('Size'), PDFNumber).asNumber()).toBe(7);
  });

  it('SAV-010 a flat tree keeps its keys in order', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    await doc.attach(new Uint8Array([1]), 'a.txt', {});
    await doc.attach(new Uint8Array([1]), 'z.txt', {});
    const out = await apply(await doc.save({ useObjectStreams: false }), { embeddedJson: '{}' });
    expect((await leavesOf(out)).flat()).toEqual(['a.txt', KEY, 'z.txt']);
  });

  it('SAV-010 with /Kids the entry is replaced in the leaf that holds it', async () => {
    const bytes = await kidsPdf([['a.txt', KEY], ['x.txt', 'z.txt']]);
    const out = await apply(bytes, { embeddedJson: '{"new":1}' });
    expect(await leavesOf(out)).toEqual([['a.txt', KEY], ['x.txt', 'z.txt']]);
    expect(await api.readEmbeddedJson(out, KEY)).toEqual(ok('{"new":1}'));
  });

  it('SAV-010 with /Kids a missing entry becomes a new leaf with /Limits at its sorted place', async () => {
    const bytes = await kidsPdf([['a.txt', 'b.txt'], ['x.txt', 'z.txt']]);
    const out = await apply(bytes, { embeddedJson: '{}' });
    expect(await leavesOf(out)).toEqual([['a.txt', 'b.txt'], [KEY], ['x.txt', 'z.txt']]);
    const doc = await PDFDocument.load(out);
    const kids = doc.catalog.lookup(n('Names'), PDFDict).lookup(n('EmbeddedFiles'), PDFDict).lookup(n('Kids'), PDFArray);
    const limits = kids.lookup(1, PDFDict).lookup(n('Limits'), PDFArray);
    expect(limits.asArray().map((v) => (v as PDFString).decodeText())).toEqual([KEY, KEY]);
  });
});

describe('PdfWriter: errors and cancellation (M15 S2)', () => {
  it('SAV-006 a damaged file gives invalid-pdf from all three operations', async () => {
    const bytes = fixture('damaged.pdf');
    expect(await api.listInk(bytes)).toEqual(err('invalid-pdf'));
    expect(await api.readEmbeddedJson(bytes, KEY)).toEqual(err('invalid-pdf'));
    expect(await api.apply(bytes, noEdits, KEY, 0)).toEqual(err('invalid-pdf'));
  });

  it.skipIf(!HAS_QPDF)('SAV-006 an encrypted file gives invalid-pdf', async () => {
    const bytes = encrypted(fixture('synthetic-score.pdf'));
    expect(await api.listInk(bytes)).toEqual(err('invalid-pdf'));
    expect(await api.apply(bytes, noEdits, KEY, 0)).toEqual(err('invalid-pdf'));
  });

  it('SAV-006 a cancelled task stops with cancelled', async () => {
    await api.cancel(7);
    expect(await api.apply(fixture('synthetic-score.pdf'), { ...noEdits, addInk: [ink('a')] }, KEY, 7)).toEqual(err('cancelled'));
    expect((await api.apply(fixture('synthetic-score.pdf'), noEdits, KEY, 7)).ok).toBe(true);
  });

  it.skipIf(HAS_QPDF)('SAV-006 qpdf is not installed: structural checks of produced files were skipped', () => {
    expect(HAS_QPDF).toBe(false);
  });
});

describe('PdfLibWriter proxy (M15 S2)', () => {
  function fakeApi(patch: Partial<PdfWriterWorkerApi> = {}): PdfWriterWorkerApi {
    return { ...createPdfWriterApi(), ...patch };
  }

  it('SAV-006 an already aborted signal cancels without creating the worker', async () => {
    const create = vi.fn(() => fakeApi());
    const controller = new AbortController();
    controller.abort();
    expect(await new PdfLibWriter(create).apply(new Uint8Array(), noEdits, controller.signal)).toEqual(err('cancelled'));
    expect(create).not.toHaveBeenCalled();
  });

  it('SAV-006 aborting a running apply answers cancelled and cancels the task in the worker', async () => {
    const cancel = vi.fn(() => Promise.resolve());
    const writer = new PdfLibWriter(() => fakeApi({ apply: () => new Promise(() => undefined), cancel }));
    const controller = new AbortController();
    const pending = writer.apply(new Uint8Array(), noEdits, controller.signal);
    controller.abort();
    expect(await pending).toEqual(err('cancelled'));
    expect(cancel).toHaveBeenCalledWith(0);
  });

  it('SAV-006 passes the metadata file name and maps a throwing worker to a typed error', async () => {
    const readEmbeddedJson = vi.fn(() => Promise.resolve(ok(null)));
    const writer = new PdfLibWriter(() => fakeApi({ readEmbeddedJson, listInk: () => Promise.reject(new RangeError('Array buffer allocation failed')) }));
    await writer.readEmbeddedJson(new Uint8Array());
    expect(readEmbeddedJson).toHaveBeenCalledWith(expect.anything(), KEY);
    expect(await writer.listInk(new Uint8Array())).toMatchObject({ ok: false, error: 'out-of-memory' });
  });

  it('SAV-006 writes through the real api end to end', async () => {
    const writer = new PdfLibWriter(() => createPdfWriterApi());
    const result = await writer.apply(fixture('synthetic-score.pdf'), { ...noEdits, addInk: [ink('a')], embeddedJson: '{}' }, new AbortController().signal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      qpdfCheck(result.value);
      expect(await writer.readEmbeddedJson(result.value)).toEqual(ok('{}'));
    }
  });
});
