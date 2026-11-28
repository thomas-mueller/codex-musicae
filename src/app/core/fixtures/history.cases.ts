/**
 * Fixtures: core/history
 * Requirements: ANN-015
 * Expected values were derived by hand from the rules of V2-M07 S1.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */

/** Op: ['push', entry name], ['undo'], ['redo'], ['clear'].
 *  `results` collects the entries returned by undo and redo in order (null if there was none).
 *  `undo` and `redo` are the final stacks: the next undo or redo is last. */
type HistoryOp = ['push', string] | ['undo'] | ['redo'] | ['clear'];

export const historyCases: ReadonlyArray<{
  id: string; req: string; name: string; depth: number; ops: HistoryOp[];
  expected: { undo: string[]; redo: string[]; results: Array<string | null>; canUndo: boolean; canRedo: boolean };
}> = [
  {
    id: 'H01',
    req: 'ANN-015',
    name: 'undo and redo on an empty history return nothing',
    depth: 3,
    ops: [['undo'], ['redo']],
    expected: { undo: [], redo: [], results: [null, null], canUndo: false, canRedo: false },
  },
  {
    id: 'H02',
    req: 'ANN-015',
    name: 'push, undo and redo make a round trip',
    depth: 3,
    ops: [['push', 'a'], ['undo'], ['redo']],
    expected: { undo: ['a'], redo: [], results: ['a', 'a'], canUndo: true, canRedo: false },
  },
  {
    id: 'H03',
    req: 'ANN-015',
    name: 'undo returns the newest first and redo replays in the original order',
    depth: 3,
    ops: [['push', 'a'], ['push', 'b'], ['push', 'c'], ['undo'], ['undo'], ['undo'], ['redo'], ['redo']],
    expected: { undo: ['a', 'b'], redo: ['c'], results: ['c', 'b', 'a', 'a', 'b'], canUndo: true, canRedo: true },
  },
  {
    id: 'H04',
    req: 'ANN-015',
    name: 'a push after undo clears the whole redo stack',
    depth: 5,
    ops: [['push', 'a'], ['push', 'b'], ['push', 'c'], ['undo'], ['undo'], ['push', 'd'], ['redo']],
    expected: { undo: ['a', 'd'], redo: [], results: ['c', 'b', null], canUndo: true, canRedo: false },
  },
  {
    id: 'H05',
    req: 'ANN-015',
    name: 'a push beyond the depth drops the oldest entry',
    depth: 3,
    ops: [['push', 'a'], ['push', 'b'], ['push', 'c'], ['push', 'd'], ['push', 'e']],
    expected: { undo: ['c', 'd', 'e'], redo: [], results: [], canUndo: true, canRedo: false },
  },
  {
    id: 'H06',
    req: 'ANN-015',
    name: 'at the depth limit, undoing and redoing everything loses nothing',
    depth: 2,
    ops: [['push', 'a'], ['push', 'b'], ['push', 'c'], ['undo'], ['undo'], ['undo'], ['redo'], ['redo']],
    expected: { undo: ['b', 'c'], redo: [], results: ['c', 'b', null, 'b', 'c'], canUndo: true, canRedo: false },
  },
  {
    id: 'H07',
    req: 'ANN-015',
    name: 'a push after undo at the depth limit keeps the older entries',
    depth: 3,
    ops: [['push', 'a'], ['push', 'b'], ['push', 'c'], ['undo'], ['push', 'd']],
    expected: { undo: ['a', 'b', 'd'], redo: [], results: ['c'], canUndo: true, canRedo: false },
  },
  {
    id: 'H08',
    req: 'ANN-015',
    name: 'depth 1 keeps only the newest entry',
    depth: 1,
    ops: [['push', 'a'], ['push', 'b'], ['undo'], ['undo']],
    expected: { undo: [], redo: ['b'], results: ['b', null], canUndo: false, canRedo: true },
  },
  {
    id: 'H09',
    req: 'ANN-015',
    name: 'depth 0 keeps nothing',
    depth: 0,
    ops: [['push', 'a'], ['undo'], ['redo']],
    expected: { undo: [], redo: [], results: [null, null], canUndo: false, canRedo: false },
  },
  {
    id: 'H10',
    req: 'ANN-015',
    name: 'interleaved pushes, undos and redos',
    depth: 4,
    ops: [['push', 'a'], ['push', 'b'], ['undo'], ['redo'], ['push', 'c'], ['undo'], ['undo'], ['redo'], ['push', 'd'], ['undo']],
    expected: { undo: ['a', 'b'], redo: ['d'], results: ['b', 'b', 'c', 'b', 'b', 'd'], canUndo: true, canRedo: true },
  },
  {
    id: 'H11',
    req: 'ANN-015',
    name: 'clear empties both stacks and later pushes work',
    depth: 3,
    ops: [['push', 'a'], ['push', 'b'], ['undo'], ['clear'], ['undo'], ['redo'], ['push', 'c']],
    expected: { undo: ['c'], redo: [], results: ['b', null, null], canUndo: true, canRedo: false },
  },
  {
    id: 'H12',
    req: 'ANN-015',
    name: 'undo past the bottom and redo past the top change nothing',
    depth: 3,
    ops: [['push', 'a'], ['undo'], ['undo'], ['redo'], ['redo']],
    expected: { undo: ['a'], redo: [], results: ['a', null, 'a', null], canUndo: true, canRedo: false },
  },
];
