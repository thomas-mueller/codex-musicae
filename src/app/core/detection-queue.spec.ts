import { describe, expect, it } from 'vitest';

import { isComplete, isProvisional, nextPageToProcess, usablePrefix } from './detection-queue';
import { isCompleteCases, isProvisionalCases, nextPageToProcessCases, usablePrefixCases } from './fixtures/detection-queue.cases';
import { caseTitle } from '../../testing/expect-close-deep';

describe('usablePrefix', () => {
  for (const c of usablePrefixCases) {
    it(caseTitle(c, 'DET-019'), () => {
      expect(usablePrefix(c.states)).toBe(c.expected);
    });
  }
});

describe('isComplete', () => {
  for (const c of isCompleteCases) {
    it(caseTitle(c, 'DET-016'), () => {
      expect(isComplete(c.states)).toBe(c.expected);
    });
  }
});

describe('nextPageToProcess', () => {
  for (const c of nextPageToProcessCases) {
    it(caseTitle(c, 'DET-021'), () => {
      expect(nextPageToProcess(c.states, c.priorityPage)).toBe(c.expected);
    });
  }
});

describe('isProvisional', () => {
  for (const c of isProvisionalCases) {
    it(caseTitle(c, 'DET-021'), () => {
      expect(isProvisional(c.pageIndex, c.states)).toBe(c.expected);
    });
  }
});
