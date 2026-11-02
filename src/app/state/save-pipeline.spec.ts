import { vi } from 'vitest';

import { parseMetadata } from '../core';
import type { InkStroke } from '../core';
import type { FileRef } from '../ports/file-access';
import { err, ok } from '../ports/result';
import { DocumentStore } from './document.store';
import { SavePipeline } from './save-pipeline';
import { Scheduler } from './scheduler';
import { fakeFileAccess, fakePdfWriter } from './testing/fake-ports';
import { fakeRenderer } from './testing/fake-renderer';

const REF: FileRef = { id: 'f1', name: 'Fuge.PDF' };
const ORIGINAL = new Uint8Array([1]);

function stroke(id: string, pageIndex = 0): InkStroke {
  return { id, pageIndex, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: '#112233', widthPt: 2, opacity: 1, multiply: false };
}

async function setup() {
  const doc = new DocumentStore('t1', fakeRenderer());
  await doc.load(ORIGINAL);
  const files = fakeFileAccess();
  const writer = fakePdfWriter();
  const scheduler = new Scheduler();
  const pipeline = new SavePipeline(doc, REF, ORIGINAL, files, writer, scheduler, 'v-test');
  const signal = new AbortController().signal;
  const lastEdits = () => writer.apply.mock.calls.at(-1)?.[1];
  return { doc, files, writer, scheduler, pipeline, signal, lastEdits };
}

describe('SavePipeline (M15 S3)', () => {
  it('SAV-009 sends new strokes as addInk and the metadata as embeddedJson', async () => {
    const { doc, pipeline, signal, lastEdits } = await setup();
    doc.addStroke(stroke('a'));
    expect(await pipeline.run(signal)).toBe(true);
    const edits = lastEdits();
    expect(edits?.addInk.map((i) => i.strokeId)).toEqual(['a']);
    expect(edits?.addInk[0]).toMatchObject({ pageIndex: 0, color: '#112233', widthPt: 2, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] });
    expect(edits?.removeInk).toEqual([]);
    expect(parseMetadata(edits?.embeddedJson ?? '').kind).toBe('ok');
  });

  it('SAV-009 only the difference is sent next time; an erased saved stroke is removed by its nm: reference', async () => {
    const { doc, pipeline, signal, lastEdits } = await setup();
    doc.addStroke(stroke('a'));
    doc.addStroke(stroke('b', 1));
    await pipeline.run(signal);
    doc.eraseStrokes([stroke('b', 1)]);
    doc.addStroke(stroke('c'));
    await pipeline.run(signal);
    expect(lastEdits()?.addInk.map((i) => i.strokeId)).toEqual(['c']);
    expect(lastEdits()?.removeInk).toEqual([{ pageIndex: 1, annotationRef: 'nm:b' }]);
    await pipeline.run(signal);
    expect(lastEdits()?.addInk).toEqual([]);
    expect(lastEdits()?.removeInk).toEqual([]);
  });

  it('SAV-009 a stroke created and erased between saves needs no operation, an undone erase none either', async () => {
    const { doc, pipeline, signal, lastEdits } = await setup();
    doc.addStroke(stroke('a'));
    await pipeline.run(signal);
    doc.addStroke(stroke('tmp'));
    doc.eraseStrokes([stroke('tmp')]);
    doc.eraseStrokes([stroke('a')]);
    doc.undo();
    await pipeline.run(signal);
    expect(lastEdits()?.addInk).toEqual([]);
    expect(lastEdits()?.removeInk).toEqual([]);
  });

  it('SAV-009 strokes read from the file are registered as saved and removed by their own reference', async () => {
    const { doc, pipeline, signal, lastEdits } = await setup();
    pipeline.registerSavedInk([{ strokeId: 'old', pageIndex: 0, annotationRef: 'obj:12' }]);
    doc.addStroke(stroke('old'));
    await pipeline.run(signal);
    expect(lastEdits()?.addInk).toEqual([]);
    doc.eraseStrokes([stroke('old')]);
    await pipeline.run(signal);
    expect(lastEdits()?.removeInk).toEqual([{ pageIndex: 0, annotationRef: 'obj:12' }]);
  });

  it('SAV-003 metadata from a newer version is never overwritten, the ink is still saved', async () => {
    const { doc, pipeline, signal, lastEdits } = await setup();
    pipeline.metadataNewer = true;
    doc.addStroke(stroke('a'));
    expect(await pipeline.run(signal)).toBe(true);
    expect(lastEdits()?.embeddedJson).toBeNull();
    expect(lastEdits()?.addInk).toHaveLength(1);
  });

  it('SAV-009 only bytes that were written successfully replace the current bytes', async () => {
    const { doc, files, writer, pipeline, signal } = await setup();
    doc.addStroke(stroke('a'));
    files.write.mockResolvedValueOnce(err('write-failed'));
    expect(await pipeline.run(signal)).toBe(false);
    expect(pipeline.currentBytes).toBe(ORIGINAL);
    // nothing was marked saved: the retry sends the same stroke from the same bytes
    expect(await pipeline.run(signal)).toBe(true);
    expect(writer.apply.mock.calls.map((c) => c[0])).toEqual([ORIGINAL, ORIGINAL]);
    expect(writer.apply.mock.calls[1]?.[1].addInk).toHaveLength(1);
    expect([...pipeline.currentBytes]).toEqual([1, 1]);
    expect(files.write).toHaveBeenLastCalledWith(REF, pipeline.currentBytes);
  });

  it('SAV-009 a writer error fails the save without writing', async () => {
    const { doc, files, writer, pipeline, signal } = await setup();
    doc.addStroke(stroke('a'));
    writer.apply.mockResolvedValueOnce(err('unknown'));
    expect(await pipeline.run(signal)).toBe(false);
    expect(files.write).not.toHaveBeenCalled();
    expect(pipeline.currentBytes).toBe(ORIGINAL);
  });

  it('FIL-016 a denied or unsupported write turns the tab read-only without an error', async () => {
    for (const error of ['denied', 'unsupported'] as const) {
      const { doc, files, pipeline, signal } = await setup();
      doc.addStroke(stroke('a'));
      files.write.mockResolvedValueOnce(err(error));
      expect(await pipeline.run(signal)).toBe('readOnly');
      expect(doc.readOnly()).toBe(true);
      expect(pipeline.currentBytes).toBe(ORIGINAL);
    }
  });

  it('SAV-009 strokes drawn while the save runs stay unsaved and go out with the next one', async () => {
    const { doc, writer, pipeline, signal, lastEdits } = await setup();
    doc.addStroke(stroke('a'));
    writer.apply.mockImplementationOnce(async (bytes) => {
      doc.addStroke(stroke('late'));
      return ok(new Uint8Array([...bytes, 1]));
    });
    await pipeline.run(signal);
    await pipeline.run(signal);
    expect(lastEdits()?.addInk.map((i) => i.strokeId)).toEqual(['late']);
  });

  it('NFR-003 the writer runs as a save task and waits while a stroke is in progress', async () => {
    const { doc, writer, scheduler, pipeline, signal } = await setup();
    doc.addStroke(stroke('a'));
    scheduler.setContext({ strokeInProgress: true });
    const running = pipeline.run(signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writer.apply).not.toHaveBeenCalled();
    scheduler.setContext({ strokeInProgress: false });
    expect(await running).toBe(true);
    expect(writer.apply).toHaveBeenCalledTimes(1);
  });

  it('SAV-011 a copy contains the pending edits, is named "<name> (annotated).pdf" and changes nothing', async () => {
    const { doc, files, writer, pipeline, signal } = await setup();
    doc.addStroke(stroke('a'));
    expect((await pipeline.saveCopy(signal)).ok).toBe(true);
    expect(files.saveCopy).toHaveBeenCalledWith('Fuge (annotated).pdf', new Uint8Array([1, 1]));
    expect(files.write).not.toHaveBeenCalled();
    expect(pipeline.currentBytes).toBe(ORIGINAL);
    await pipeline.run(signal);
    expect(writer.apply.mock.calls.at(-1)?.[1].addInk).toHaveLength(1);
  });

  it('SAV-011 a copy fails when the writer fails, and passes the platform result through', async () => {
    const { doc, files, writer, pipeline, signal } = await setup();
    doc.addStroke(stroke('a'));
    writer.apply.mockResolvedValueOnce(err('invalid-pdf'));
    expect(await pipeline.saveCopy(signal)).toMatchObject({ ok: false, error: 'failed' });
    files.saveCopy.mockResolvedValueOnce(err('cancelled'));
    expect(await pipeline.saveCopy(signal)).toMatchObject({ ok: false, error: 'cancelled' });
    expect(vi.isMockFunction(files.saveCopy)).toBe(true);
  });
});
