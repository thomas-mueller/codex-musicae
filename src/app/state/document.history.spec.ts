import { EMPTY_SYSTEM_MARKS } from '../core';
import type { SystemMarks, V1Marks } from '../core';
import { TUNABLES } from '../../config/tunables';
import { DocumentStore } from './document.store';
import { fakeRenderer } from './testing/fake-renderer';

const PAGES = 2;
const PER_PAGE = 3;
const SIZE = { width: 600, height: 800 };
const boxes = Array.from({ length: PER_PAGE }, (_, i) => ({ x: 40, y: 20 + 150 * i, width: 500, height: 100 }));
const at = (pageIndex: number, system: number) => ({ pageIndex, system });
const stroke = {
  id: 's', pageIndex: 0, points: [{ x: 1, y: 1 }], color: TUNABLES.colors.penPresets[0] as string, widthPt: 1, opacity: 1, multiply: false,
};

/** Two pages of three systems each, all detected. */
async function readyDoc(): Promise<DocumentStore> {
  const doc = new DocumentStore('t1', fakeRenderer('invalid', PAGES));
  await doc.load(new Uint8Array([1]));
  doc.detection.reset(PAGES);
  for (let i = 0; i < PAGES; i++) {
    doc.detection.finish(i, 'done', { pageIndex: i, ...SIZE, systems: boxes });
  }
  return doc;
}

/** The marks without the id counters, which never go back. */
const listed = (marks: SystemMarks) => ({ ...marks, nextJumpId: 0, nextBookmarkId: 0 });

/** Runs one edit, then checks that undo leads back to the marks before it and redo to the marks after it. */
function roundTrip(doc: DocumentStore, edit: () => void): void {
  const before = listed(doc.systemMarks());
  edit();
  const after = listed(doc.systemMarks());
  expect(after).not.toStrictEqual(before);
  doc.edits.organization.undo();
  expect(listed(doc.systemMarks())).toStrictEqual(before);
  doc.edits.organization.redo();
  expect(listed(doc.systemMarks())).toStrictEqual(after);
}

describe('DocumentStore edit histories', () => {
  it('ANN-015 ANN-016 every edit of the junction chips is one organization step', async () => {
    const doc = await readyDoc();
    let id = 0;
    roundTrip(doc, () => (id = doc.addJump({ origin: 2, target: 0, pass: 1 })!));
    roundTrip(doc, () => doc.updateJump(id, { pass: 2 }));
    roundTrip(doc, () => doc.updateJump(id, { target: 3 }));
    roundTrip(doc, () => doc.toggleBreak(2));
    roundTrip(doc, () => doc.toggleStop(2));
    roundTrip(doc, () => doc.toggleStop(2));
    roundTrip(doc, () => doc.toggleStop(2));
    roundTrip(doc, () => doc.clearJunction(2));
    const other = doc.addJump({ origin: 4, target: 0, pass: 1 })!;
    roundTrip(doc, () => doc.removeJump(other));
  });

  it('ANN-015 addMark and removeMark are undoable steps for every kind of mark', async () => {
    const doc = await readyDoc();
    roundTrip(doc, () => expect(doc.addMark({ kind: 'jump', from: at(1, 2), to: at(0, 1), pass: 1 })).toBe(true));
    roundTrip(doc, () => doc.addMark({ kind: 'bookmark', at: at(0, 2), text: 'A' }));
    roundTrip(doc, () => doc.addMark({ kind: 'start', at: at(0, 2) }));
    roundTrip(doc, () => doc.addMark({ kind: 'start', at: at(1, 1) }));
    roundTrip(doc, () => doc.addMark({ kind: 'stop', at: at(0, 3) }));
    roundTrip(doc, () => doc.addMark({ kind: 'break', at: at(0, 3) }));
    roundTrip(doc, () => doc.removeMark({ kind: 'jump', id: 1 }));
    roundTrip(doc, () => doc.removeMark({ kind: 'bookmark', id: 1 }));
    roundTrip(doc, () => doc.removeMark({ kind: 'start' }));
    roundTrip(doc, () => doc.removeMark({ kind: 'stop', at: at(0, 3) }));
    roundTrip(doc, () => doc.removeMark({ kind: 'break', at: at(0, 3) }));
  });

  it('ANN-015 undoing an added jump keeps its id used', async () => {
    const doc = await readyDoc();
    const first = doc.addJump({ origin: 2, target: 0, pass: 1 })!;
    doc.edits.organization.undo();
    expect(doc.addJump({ origin: 4, target: 0, pass: 1 })).toBe(first + 1);
  });

  it('ANN-015 the playing order follows undo and redo', async () => {
    const doc = await readyDoc();
    const printOrder = doc.playingOrder().entries;
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    const jumped = doc.playingOrder().entries;
    doc.edits.organization.undo();
    expect(doc.playingOrder().entries).toEqual(printOrder);
    doc.edits.organization.redo();
    expect(doc.playingOrder().entries).toEqual(jumped);
  });

  it('ANN-017 MRK-013 undoing a system deletion restores the marks on both sides and the numbers of the later systems', async () => {
    const doc = await readyDoc();
    doc.addMark({ kind: 'jump', from: at(0, 2), to: at(0, 1), pass: 1 });
    doc.addMark({ kind: 'jump', from: at(1, 1), to: at(0, 3), pass: 1 });
    doc.addMark({ kind: 'stop', at: at(0, 2) });
    doc.addMark({ kind: 'break', at: at(0, 3) });
    doc.addMark({ kind: 'bookmark', at: at(0, 2) });
    const before = doc.systemMarks();
    roundTrip(doc, () => doc.deleteSystemMarks(at(0, 2)));
    expect(doc.systemMarks().jumps).toEqual([{ id: 2, from: at(1, 1), to: at(0, 2), pass: 1 }]);
    expect(doc.systemMarks().breaks).toEqual([{ at: at(0, 2) }]);
    expect(doc.systemMarks().stops).toEqual([]);
    doc.edits.organization.undo();
    expect(doc.systemMarks()).toStrictEqual(before);
    // the step relies on the page of the deleted system
    expect(doc.edits.organization.history().redo[0]?.pages).toContain(0);
  });

  it('ANN-015 a deletion that changes no mark records no step', async () => {
    const doc = await readyDoc();
    doc.deleteSystemMarks(at(0, 2));
    expect(doc.edits.organization.canUndo()).toBe(false);
  });

  it('ANN-015 rejected edits and edits that change nothing record no step', async () => {
    const doc = await readyDoc();
    expect(doc.addMark({ kind: 'jump', from: at(0, 1), to: at(0, 2), pass: 1 })).toBe(false);
    doc.removeMark({ kind: 'jump', id: 7 });
    doc.removeJump(7);
    doc.toggleStop(0);
    doc.clearJunction(2);
    expect(doc.edits.organization.canUndo()).toBe(false);
    const id = doc.addJump({ origin: 2, target: 0, pass: 1 })!;
    doc.updateJump(id, { pass: 1 });
    expect(doc.edits.organization.history().undo).toHaveLength(1);
  });

  it('ANN-015 while V1 marks wait, edits are rejected and the history stays empty', async () => {
    const doc = new DocumentStore('t1', fakeRenderer('invalid', PAGES));
    await doc.load(new Uint8Array([1]));
    const waiting: V1Marks = { jumps: [], breaks: [1], stops: [], nextJumpId: 1 };
    doc.hydrateFromMetadata(
      { schemaVersion: 2, appVersion: 'v', pageCount: PAGES, detection: null, marks: EMPTY_SYSTEM_MARKS, aspectRatio: {} },
      waiting,
    );
    doc.deleteSystemMarks(at(0, 1));
    expect(doc.addMark({ kind: 'start', at: at(0, 1) })).toBe(false);
    expect(doc.edits.organization.canUndo()).toBe(false);
  });

  it('ANN-015 each mode undoes only its own edits', async () => {
    const doc = await readyDoc();
    doc.addStroke(stroke);
    doc.toggleStop(2);
    doc.undo();
    expect(doc.strokes()).toEqual([]);
    expect(doc.marks().stops).toEqual([2]);
    doc.redo();
    doc.edits.organization.undo();
    expect(doc.marks().stops).toEqual([]);
    expect(doc.strokes()).toHaveLength(1);
  });

  it('ANN-015 closing the document clears both histories', async () => {
    const doc = await readyDoc();
    doc.addStroke(stroke);
    doc.toggleStop(2);
    await doc.dispose();
    expect(doc.edits.annotation.canUndo()).toBe(false);
    expect(doc.edits.organization.canUndo()).toBe(false);
  });
});
