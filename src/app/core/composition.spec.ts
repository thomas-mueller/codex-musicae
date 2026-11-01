import { describe, expect, it } from 'vitest';

import { composeSlide } from './composition';
import { composeSlideCases } from './fixtures/composition.cases';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

const EPS = 1e-9;

describe('composeSlide', () => {
  for (const c of composeSlideCases) {
    it(caseTitle(c, 'SLD-007'), () => {
      expectCloseDeep(composeSlide(c.plan, c.systems, c.pages), c.expected);
    });
  }

  it('SLD-008 dest has the size of source and sources lie inside their page', () => {
    for (const c of composeSlideCases) {
      for (const content of composeSlide(c.plan, c.systems, c.pages).contents) {
        const page = c.pages[content.pageIndex];
        expect(content.dest.width).toBeCloseTo(content.source.width, 9);
        expect(content.dest.height).toBeCloseTo(content.source.height, 9);
        expect(content.source.x).toBeGreaterThanOrEqual(-EPS);
        expect(content.source.y).toBeGreaterThanOrEqual(-EPS);
        expect(content.source.x + content.source.width).toBeLessThanOrEqual((page?.width ?? 0) + EPS);
        expect(content.source.y + content.source.height).toBeLessThanOrEqual((page?.height ?? 0) + EPS);
      }
    }
  });

  it('SLD-009 overlays are full-width, sorted by y and do not overlap', () => {
    for (const c of composeSlideCases) {
      const { overlays } = composeSlide(c.plan, c.systems, c.pages);
      let end = -Infinity;
      for (const o of overlays) {
        expect(o.x).toBe(0);
        expect(o.width).toBeCloseTo(c.plan.width, 9);
        expect(o.y).toBeGreaterThanOrEqual(end - EPS);
        end = o.y + o.height;
      }
    }
  });
});
