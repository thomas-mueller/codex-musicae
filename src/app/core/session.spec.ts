import { describe, expect, it } from 'vitest';

import { parseSessionCases } from './fixtures/session.cases';
import { parseSession } from './session';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

describe('parseSession', () => {
  for (const c of parseSessionCases) {
    it(caseTitle(c, 'FIL-011'), () => {
      const actual = parseSession(c.raw);
      if (c.expected === null) {
        expect(actual).toBeNull();
      } else {
        expectCloseDeep(actual, c.expected);
      }
    });
  }
});
