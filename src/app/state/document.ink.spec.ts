import { TUNABLES } from '../../config/tunables';
import type { InkStroke } from '../core';
import type { DocChange } from './document.store';
import { DocumentStore } from './document.store';
import { fakeRenderer } from './testing/fake-renderer';

function stroke(id: string, pageIndex = 0): InkStroke {
  return {
    id,
    pageIndex,
    points: [
      { x: 10, y: 20 },
      { x: -5, y: 700 }, // beyond the page edge is allowed (ANN-009)
    ],
    color: TUNABLES.colors.penPresets[0] as string,
    widthPt: 2.5,
    opacity: 1,
    multiply: false,
  };
}

const ids = (doc: DocumentStore) => doc.strokes().map((s) => s.id);

describe('DocumentStore ink (M14 S2)', () => {
  it('ANN-006 adding, undoing and redoing a stroke', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    expect(doc.canUndo()).toBe(false);
    doc.addStroke(stroke('a'));
    expect(ids(doc)).toEqual(['a']);
    expect(doc.canUndo()).toBe(true);
    doc.undo();
    expect(ids(doc)).toEqual([]);
    expect(doc.canRedo()).toBe(true);
    doc.redo();
    expect(ids(doc)).toEqual(['a']);
    expect(doc.canRedo()).toBe(false);
  });

  it('ANN-006 undo and redo with an empty history change nothing and emit nothing', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    const events: DocChange[] = [];
    doc.changes.subscribe((e) => events.push(e));
    doc.undo();
    doc.redo();
    expect(events).toEqual([]);
    expect(doc.history()).toEqual({ undo: [], redo: [] });
  });

  it('ANN-006 a new action clears the redo stack', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    doc.addStroke(stroke('a'));
    doc.undo();
    doc.addStroke(stroke('b'));
    expect(doc.canRedo()).toBe(false);
    expect(ids(doc)).toEqual(['b']);
  });

  it('ANN-006 erasing several strokes is one undo step; undo brings them back, redo erases again', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    doc.addStroke(stroke('a'));
    doc.addStroke(stroke('b'));
    doc.addStroke(stroke('c'));
    doc.eraseStrokes([stroke('a'), stroke('c')]);
    expect(ids(doc)).toEqual(['b']);
    expect(doc.history().undo).toHaveLength(4);
    doc.undo();
    expect(ids(doc).sort()).toEqual(['a', 'b', 'c']);
    doc.redo();
    expect(ids(doc)).toEqual(['b']);
  });

  it('ANN-006 erasing strokes that are not present pushes no step', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    doc.addStroke(stroke('a'));
    const before = doc.history();
    doc.eraseStrokes([]);
    doc.eraseStrokes([stroke('zzz')]);
    expect(doc.history()).toBe(before);
  });

  it('ANN-006 a stroke whose id exists is ignored', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    doc.addStroke(stroke('a'));
    doc.addStroke(stroke('a'));
    expect(ids(doc)).toEqual(['a']);
    expect(doc.history().undo).toHaveLength(1);
  });

  it('ANN-006 the history keeps at most T:annotation.undoDepth steps', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    const depth = TUNABLES.annotation.undoDepth;
    for (let i = 0; i <= depth; i++) {
      doc.addStroke(stroke(`s${i}`));
    }
    expect(doc.history().undo).toHaveLength(depth);
    for (let i = 0; i < depth + 5; i++) {
      doc.undo();
    }
    expect(ids(doc)).toEqual(['s0']); // the oldest step fell out of the history
  });

  it('ANN-006 dispose clears strokes and history', async () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    doc.addStroke(stroke('a'));
    doc.undo();
    await doc.dispose();
    expect(doc.strokes()).toEqual([]);
    expect(doc.history()).toEqual({ undo: [], redo: [] });
  });

  it('SAV-007 ANN-009 ANN-012 strokesOfPage groups by the fixed page and keeps the points untouched', () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    const a = stroke('a', 1);
    doc.addStroke(a);
    doc.addStroke(stroke('b', 0));
    doc.addStroke(stroke('c', 1));
    expect(doc.strokesOfPage(1).map((s) => s.id)).toEqual(['a', 'c']);
    expect(doc.strokesOfPage(0).map((s) => s.id)).toEqual(['b']);
    expect(doc.strokesOfPage(7)).toEqual([]);
    expect(doc.strokesOfPage(1)[0]).toBe(a);
    doc.undo();
    expect(doc.strokesOfPage(1).map((s) => s.id)).toEqual(['a']);
  });

  it('ANN-011 changes emits change for add, erase, undo and redo, and stroke start and end with the clock time', () => {
    let time = 100;
    const doc = new DocumentStore('t1', fakeRenderer(), undefined, () => time++);
    const events: DocChange[] = [];
    doc.changes.subscribe((e) => events.push(e));
    doc.strokeStarted();
    doc.addStroke(stroke('a'));
    doc.strokeEnded();
    doc.eraseStrokes([stroke('a')]);
    doc.undo();
    doc.redo();
    expect(events.map((e) => e.type)).toEqual(['strokeStart', 'change', 'strokeEnd', 'change', 'change', 'change']);
    expect(events.map((e) => e.t)).toEqual([100, 101, 102, 103, 104, 105]);
  });

  it('ANN-011 the change stream completes when the tab is disposed', async () => {
    const doc = new DocumentStore('t1', fakeRenderer());
    let completed = false;
    doc.changes.subscribe({ complete: () => (completed = true) });
    await doc.dispose();
    expect(completed).toBe(true);
  });
});
