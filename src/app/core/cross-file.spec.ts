import { describe, expect, it } from 'vitest';

import { frozen } from '../../testing/deep-freeze';
import { crossReferences, lookupFile, referencedFiles, targetState } from './cross-file';
import { exitCases, lookupCases, targetCases } from './fixtures/cross-file.cases';
import { EMPTY_SYSTEM_MARKS } from './marks';
import { generatePlayingOrder } from './playing-order';

describe('lookupFile', () => {
  for (const c of lookupCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(lookupFile('B.pdf', frozen(c.open), frozen(c.accessible))).toEqual(c.expected);
    });
  }
});

describe('targetState', () => {
  for (const c of targetCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(targetState(frozen(c.reference), frozen(c.matches))).toBe(c.expected);
    });
  }
});

describe('exits of the playing order', () => {
  for (const c of exitCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(generatePlayingOrder(frozen(c.input))).toStrictEqual(c.expected);
    });
  }
});

describe('references of a document', () => {
  it('MRK-012 FIL-042 jump and bookmark targets count, local marks do not, and each file is named once', () => {
    const to = { file: 'B.pdf', pageIndex: 0, system: 1 };
    const marks = {
      ...EMPTY_SYSTEM_MARKS,
      jumps: [
        { id: 1, from: { pageIndex: 0, system: 1 }, to, pass: 1 },
        { id: 2, from: { pageIndex: 0, system: 2 }, to: { pageIndex: 0, system: 1 }, pass: 1 },
      ],
      bookmarks: [
        { id: 1, at: { pageIndex: 0, system: 1 }, ref: { ...to, file: 'C.pdf' } },
        { id: 2, at: { pageIndex: 0, system: 2 }, ref: to },
        { id: 3, at: { pageIndex: 0, system: 3 } },
      ],
    };
    expect(crossReferences(marks)).toHaveLength(3);
    expect(referencedFiles(marks)).toEqual(['B.pdf', 'C.pdf']);
  });
});
