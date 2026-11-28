import { describe, expect, it } from 'vitest';

import { canRedo, canUndo, clearHistory, dropEntries, EMPTY_HISTORY, pushEntry, redoEntry, undoEntry } from './history';
import type { EditHistory, HistoryStep } from './history';
import { historyCases } from './fixtures/history.cases';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';

interface Entry {
  readonly name: string;
}

const names = (entries: readonly Entry[]): string[] => entries.map((entry) => entry.name);

describe('edit history', () => {
  for (const c of historyCases) {
    it(caseTitle(c, 'ANN-015'), () => {
      let history: EditHistory<Entry> = EMPTY_HISTORY;
      const results: Array<string | null> = [];
      const take = (step: HistoryStep<Entry>): void => {
        history = step.history;
        results.push(step.entry?.name ?? null);
      };
      for (const op of c.ops) {
        const input = frozen(history);
        switch (op[0]) {
          case 'push':
            history = pushEntry(input, { name: op[1] }, c.depth);
            break;
          case 'undo':
            take(undoEntry(input));
            break;
          case 'redo':
            take(redoEntry(input));
            break;
          case 'clear':
            history = clearHistory(input);
            break;
        }
      }
      expect(names(history.undo)).toEqual(c.expected.undo);
      expect(names(history.redo)).toEqual(c.expected.redo);
      expect(results).toEqual(c.expected.results);
      expect(canUndo(history)).toBe(c.expected.canUndo);
      expect(canRedo(history)).toBe(c.expected.canRedo);
    });
  }

  it('ANN-015 undo and redo hand back the entry itself', () => {
    const entry: Entry = { name: 'a' };
    const undone = undoEntry(pushEntry(EMPTY_HISTORY, entry, 1));
    expect(undone.entry).toBe(entry);
    expect(redoEntry(undone.history).entry).toBe(entry);
  });

  it('ANN-015 a step with nothing to do returns the same history', () => {
    const history = frozen<EditHistory<Entry>>({ undo: [], redo: [] });
    expect(undoEntry(history).history).toBe(history);
    expect(redoEntry(history).history).toBe(history);
    expect(clearHistory(history)).toBe(history);
  });

  it('ANN-015 the empty history stays empty after use', () => {
    pushEntry<Entry>(EMPTY_HISTORY, { name: 'a' }, 1);
    expect(EMPTY_HISTORY).toStrictEqual({ undo: [], redo: [] });
  });

  it('ANN-015 dropping removes the matching entries from both stacks and keeps the order', () => {
    const history = frozen<EditHistory<Entry>>({ undo: [{ name: 'a' }, { name: 'x' }, { name: 'b' }], redo: [{ name: 'x' }, { name: 'c' }] });
    const dropped = dropEntries(history, (entry) => entry.name === 'x');
    expect(names(dropped.undo)).toEqual(['a', 'b']);
    expect(names(dropped.redo)).toEqual(['c']);
  });

  it('ANN-015 dropping nothing returns the same history', () => {
    const history = frozen<EditHistory<Entry>>({ undo: [{ name: 'a' }], redo: [] });
    expect(dropEntries(history, () => false)).toBe(history);
  });
});
