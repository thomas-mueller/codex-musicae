import { describe, expect, it } from 'vitest';

import { addMarkCases, defaultPassCases, removeSystemCases, rerunPageCases } from './fixtures/marks.cases';
import { addMark, defaultPass, removeMarksOfSystem, rerunPage } from './marks';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';

// `toStrictEqual`: an absent `text` or `ref` is not the same as the key with `undefined`.
describe('addMark', () => {
  for (const c of addMarkCases) {
    it(caseTitle(c, 'MRK-001'), () => {
      expect(addMark(frozen(c.marks), frozen(c.mark), frozen(c.counts))).toStrictEqual(c.expected);
    });
  }
});

describe('defaultPass', () => {
  for (const c of defaultPassCases) {
    it(caseTitle(c, 'MRK-008'), () => {
      expect(defaultPass(frozen(c.marks), c.from)).toBe(c.expected);
    });
  }
});

describe('removeMarksOfSystem', () => {
  for (const c of removeSystemCases) {
    it(caseTitle(c, 'MRK-013'), () => {
      expect(removeMarksOfSystem(frozen(c.marks), frozen(c.deleted))).toStrictEqual(c.expected);
    });
  }
});

describe('rerunPage', () => {
  for (const c of rerunPageCases) {
    it(caseTitle(c, 'MRK-014'), () => {
      expect(rerunPage(frozen(c.marks), c.pageIndex, c.oldCount, c.newCount)).toStrictEqual(c.expected);
    });
  }
});
