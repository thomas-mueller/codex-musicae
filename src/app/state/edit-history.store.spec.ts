import { TUNABLES } from '../../config/tunables';
import { EditHistoryStore } from './edit-history.store';
import type { AnnotationCommand, OrganizationCommand } from './edit-history.store';

const DEPTH = 3;
const log: string[] = [];

const ink = (name: string): AnnotationCommand => ({
  kind: 'erase',
  strokes: [],
  do: () => log.push(`do ${name}`),
  undo: () => log.push(`undo ${name}`),
});

const marks = (name: string, pages: number[]): OrganizationCommand => ({
  pages,
  change: { removed: [], added: [{ kind: 'stop', mark: { at: { pageIndex: pages[0]!, system: name.length } } }] },
  do: () => log.push(`do ${name}`),
  undo: () => log.push(`undo ${name}`),
});

describe('EditHistoryStore', () => {
  beforeEach(() => (log.length = 0));

  it('ANN-015 recording does the edit; undo reverts it and redo does it again', () => {
    const edits = new EditHistoryStore(DEPTH);
    edits.annotation.record(ink('a'));
    edits.annotation.undo();
    edits.annotation.redo();
    expect(log).toEqual(['do a', 'undo a', 'do a']);
  });

  it('ANN-016 can undo and redo follow the history; with nothing to do, nothing runs', () => {
    const edits = new EditHistoryStore(DEPTH);
    const controls = edits.of('organization');
    expect([controls.canUndo(), controls.canRedo()]).toEqual([false, false]);
    controls.undo();
    controls.redo();
    expect(log).toEqual([]);
    edits.organization.record(marks('a', [0]));
    expect([controls.canUndo(), controls.canRedo()]).toEqual([true, false]);
    controls.undo();
    expect([controls.canUndo(), controls.canRedo()]).toEqual([false, true]);
  });

  it('ANN-015 the two modes have histories of their own', () => {
    const edits = new EditHistoryStore(DEPTH);
    edits.annotation.record(ink('a'));
    edits.organization.record(marks('bb', [0]));
    edits.of('annotation').undo();
    expect(edits.of('organization').canRedo()).toBe(false);
    edits.of('organization').undo();
    expect(log).toEqual(['do a', 'do bb', 'undo a', 'undo bb']);
    edits.annotation.record(ink('c')); // a new edit clears the redo stack of its own mode only
    expect(edits.annotation.canRedo()).toBe(false);
    expect(edits.organization.canRedo()).toBe(true);
  });

  it('ANN-015 each history is bounded on its own', () => {
    const edits = new EditHistoryStore(DEPTH);
    for (let i = 0; i < DEPTH + 2; i++) {
      edits.annotation.record(ink(`${i}`));
    }
    edits.organization.record(marks('a', [0]));
    expect(edits.annotation.history().undo).toHaveLength(DEPTH);
    expect(edits.organization.history().undo).toHaveLength(1);
  });

  it('ANN-015 clear empties both histories', () => {
    const edits = new EditHistoryStore(DEPTH);
    edits.annotation.record(ink('a'));
    edits.organization.record(marks('bb', [0]));
    edits.organization.undo();
    edits.clear();
    expect(edits.annotation.history()).toEqual({ undo: [], redo: [] });
    expect(edits.organization.history()).toEqual({ undo: [], redo: [] });
  });

  it('ANN-015 a changed page drops its organization steps from both stacks and leaves the ink history', () => {
    const edits = new EditHistoryStore(DEPTH);
    edits.annotation.record(ink('a'));
    edits.organization.record(marks('b', [0]));
    edits.organization.record(marks('cc', [1]));
    edits.organization.record(marks('ddd', [1]));
    edits.organization.undo();
    edits.invalidatePages(new Set([1]));
    expect(edits.organization.history().undo).toHaveLength(1);
    expect(edits.organization.canRedo()).toBe(false);
    expect(edits.annotation.canUndo()).toBe(true);
  });

  it('ANN-015 the history depth is the one of the V1 undo steps', () => {
    expect(TUNABLES.history.depth).toBe(TUNABLES.annotation.undoDepth);
  });
});
