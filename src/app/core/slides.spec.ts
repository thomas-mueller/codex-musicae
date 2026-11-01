import { describe, expect, it } from 'vitest';

import { findEntryForSystemCases } from './fixtures/entry-lookup.cases';
import { packSlidesCases, referenceWidthCases, slideIndexOfEntryCases } from './fixtures/slides.cases';
import { findEntryForSystem, packSlides, referenceWidth, slideIndexOfEntry } from './slides';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

const EPS = 1e-9;

describe('referenceWidth', () => {
  for (const c of referenceWidthCases) {
    it(caseTitle(c, 'SLD-002'), () => {
      expectCloseDeep(referenceWidth(c.systems), c.expected);
    });
  }
});

describe('packSlides', () => {
  for (const c of packSlidesCases) {
    it(caseTitle(c, 'SLD-003'), () => {
      expectCloseDeep(packSlides(c.input), c.expected);
    });
  }

  it('SLD-003 slide entry ranges cover 0..entries.length-1 without gaps or overlap', () => {
    for (const c of packSlidesCases) {
      const slides = packSlides(c.input);
      let next = 0;
      for (const s of slides) {
        expect(s.entryStart).toBe(next);
        expect(s.entryEnd).toBeGreaterThanOrEqual(s.entryStart);
        next = s.entryEnd + 1;
      }
      expect(next).toBe(c.input.entries.length);
    }
  });

  it('SLD-003 every non-enlarged slide has stackHeight <= height', () => {
    for (const c of packSlidesCases) {
      for (const s of packSlides(c.input)) {
        if (!s.enlarged) {
          expect(s.stackHeight).toBeLessThanOrEqual(s.height + EPS);
        }
      }
    }
  });
});

describe('slideIndexOfEntry', () => {
  const sp02 = packSlidesCases.find((c) => c.id === 'SP02');
  for (const c of slideIndexOfEntryCases) {
    it(`${c.req} ${c.id}: entry ${c.entryIndex} -> slide ${c.expected}`, () => {
      if (!sp02) {
        throw new Error('fixture SP02 missing');
      }
      expect(slideIndexOfEntry(packSlides(sp02.input), c.entryIndex)).toBe(c.expected);
    });
  }
});

describe('findEntryForSystem', () => {
  for (const c of findEntryForSystemCases) {
    it(caseTitle(c, 'SLD-012'), () => {
      expect(findEntryForSystem(c.entries, c.systemIndex)).toBe(c.expected);
    });
  }
});
