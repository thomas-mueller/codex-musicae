import { describe, expect, it } from 'vitest';

import { applyMarkChange, markChange, pagesOfChange, staleSteps } from './mark-change';
import { removeMark } from './marks';
import { markChangeCases, removeMarkCases, staleStepCases } from './fixtures/mark-change.cases';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';
import { EMPTY_SYSTEM_MARKS } from './marks';

describe('removeMark', () => {
  const full = markChangeCases[1]!.before;
  for (const c of removeMarkCases) {
    it(caseTitle(c, 'ANN-015'), () => {
      const input = frozen(full);
      const result = removeMark(input, c.key);
      if (c.expected === 'same') {
        expect(result).toBe(input);
      } else {
        expect(result).toStrictEqual(c.expected);
      }
    });
  }

  it('ANN-015 there is nothing to remove from a file without a start mark', () => {
    expect(removeMark(EMPTY_SYSTEM_MARKS, { kind: 'start' })).toBe(EMPTY_SYSTEM_MARKS);
  });
});

describe('mark changes', () => {
  for (const c of markChangeCases) {
    it(caseTitle(c, 'ANN-015'), () => {
      const change = markChange(frozen(c.before), frozen(c.after))!;
      expect(change).toStrictEqual(c.change);
      expect(pagesOfChange(change)).toEqual(c.pages);
      const undone = applyMarkChange(frozen(c.after), frozen(change), 'undo');
      // the ids handed out stay used
      expect(undone).toStrictEqual({ ...c.before, nextJumpId: c.after.nextJumpId, nextBookmarkId: c.after.nextBookmarkId });
      expect(applyMarkChange(frozen(undone), frozen(change), 'redo')).toStrictEqual(c.after);
    });
  }

  it('ANN-015 doing an added jump for the first time takes its id, and undoing it does not give the id back', () => {
    const { before, after, change } = markChangeCases[0]!;
    const done = applyMarkChange(before, change, 'redo');
    expect(done).toStrictEqual(after);
    expect(applyMarkChange(done, change, 'undo').nextJumpId).toBe(after.nextJumpId);
  });

  it('ANN-015 equal marks give no change, whatever the order of their keys and the next ids', () => {
    const { before } = markChangeCases[1]!;
    const copy = {
      ...before,
      jumps: before.jumps.map(({ id, from, to, pass }) => ({ pass, to: { ...to }, from: { ...from }, id })),
      nextJumpId: before.nextJumpId + 1,
    };
    expect(markChange(before, copy)).toBeNull();
  });
});

describe('staleSteps', () => {
  for (const c of staleStepCases) {
    it(caseTitle(c, 'ANN-015'), () => {
      const stale = staleSteps(c.steps, new Set(c.changed));
      expect(c.steps.filter((step) => stale.has(step)).map((step) => step.name)).toEqual(c.stale);
    });
  }
});
