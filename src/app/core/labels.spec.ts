import { describe, expect, it } from 'vitest';

import { formatLabelCases, LABEL_FORMAT } from './fixtures/labels.cases';
import { formatLabel } from './labels';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle } from '../../testing/expect-close-deep';

describe('formatLabel', () => {
  for (const c of formatLabelCases) {
    it(caseTitle(c, 'MRK-009'), () => {
      expect(formatLabel(frozen(c.input), c.currentFile, frozen(LABEL_FORMAT))).toBe(c.expected);
    });
  }
});
