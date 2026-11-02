import { parseMetadata, serializeMetadata } from '../core';
import { DocumentStore } from './document.store';
import { fakeRenderer } from './testing/fake-renderer';

const VERSION = 'v0.15.0-1-gabc';
const PAGE = { width: 600, height: 800 };

async function readyDoc(pageCount = 2): Promise<DocumentStore> {
  const doc = new DocumentStore('t1', fakeRenderer('invalid', pageCount));
  await doc.load(new Uint8Array([1]));
  return doc;
}

describe('DocumentStore metadata (M15 S1)', () => {
  it('SAV-004 a fresh document has no detection, no marks and no ratios', async () => {
    const doc = await readyDoc();
    expect(doc.buildMetadata(VERSION)).toEqual({
      schemaVersion: 1,
      appVersion: VERSION,
      pageCount: 2,
      detection: null,
      marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
      aspectRatio: {},
    });
  });

  it('SAV-004 detection is written only for a complete run; failed pages have no systems', async () => {
    const doc = await readyDoc();
    doc.detection.reset(2);
    doc.detection.finish(0, 'done', { pageIndex: 0, ...PAGE, systems: [{ x: 1, y: 2, width: 3, height: 4 }] });
    expect(doc.buildMetadata(VERSION).detection).toBeNull();
    doc.detection.finish(1, 'failed', null);
    expect(doc.buildMetadata(VERSION).detection).toEqual({
      level: doc.detection.level(),
      pages: [
        { pageIndex: 0, ...PAGE, state: 'done', systems: [{ x: 1, y: 2, width: 3, height: 4 }] },
        { pageIndex: 1, ...PAGE, state: 'failed', systems: [] },
      ],
    });
  });

  it('SAV-004 detection is null while a re-run is in progress', async () => {
    const doc = await readyDoc(1);
    doc.detection.reset(1);
    doc.detection.finish(0, 'done', { pageIndex: 0, ...PAGE, systems: [] });
    expect(doc.buildMetadata(VERSION).detection).not.toBeNull();
    doc.candidate.set(doc.detection);
    expect(doc.buildMetadata(VERSION).detection).toBeNull();
  });

  it('SAV-002 SAV-004 build, serialize, parse and hydrate round trip', async () => {
    const source = await readyDoc();
    source.detection.reset(2);
    source.detection.finish(0, 'done', { pageIndex: 0, ...PAGE, systems: [{ x: 10, y: 20, width: 300, height: 100 }] });
    source.detection.finish(1, 'failed', null);
    source.detection.level.set('fine');
    source.replaceMarks({ jumps: [{ id: 2, origin: 1, target: 0, pass: 1 }], breaks: [1], stops: [1], nextJumpId: 3 });
    source.ratioOverride.set({ landscape: 1.5 });
    const meta = source.buildMetadata(VERSION);

    const parsed = parseMetadata(serializeMetadata(meta));
    expect(parsed.kind).toBe('ok');
    if (parsed.kind !== 'ok') {
      return;
    }
    const target = await readyDoc();
    target.hydrateFromMetadata(parsed.value);
    expect(target.buildMetadata(VERSION)).toEqual(meta);
    expect(target.detectionComplete()).toBe(true);
    expect(target.detection.level()).toBe('fine');
    expect(target.marks().nextJumpId).toBe(3);
  });

  it('DET-023 hydrating without detection leaves detection untouched', async () => {
    const doc = await readyDoc();
    doc.hydrateFromMetadata({
      schemaVersion: 1,
      appVersion: VERSION,
      pageCount: 2,
      detection: null,
      marks: { jumps: [], breaks: [2], stops: [], nextJumpId: 1 },
      aspectRatio: { portrait: 0.7 },
    });
    expect(doc.detection.states()).toEqual([]);
    expect(doc.marks().breaks).toEqual([2]);
    expect(doc.ratioOverride()).toEqual({ portrait: 0.7 });
  });
});
