import { describe, expect, it } from 'vitest';

import { computePaddings, gapsOnPage, median, paddedArea, selectSystemRects } from './detection';
import {
  computePaddingsCases, detectionParams, gapsOnPageCases, medianCases, paddedAreaCases, selectSystemRectsCases,
} from './fixtures/detection.cases';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

describe('selectSystemRects', () => {
  for (const c of selectSystemRectsCases) {
    it(caseTitle(c, 'DET-005'), () => {
      expectCloseDeep(selectSystemRects(c.rects, c.pageWidth, detectionParams[c.params]), c.expected);
    });
  }

  it('DET-005 does not modify its input array or its rectangles', () => {
    for (const c of selectSystemRectsCases) {
      const before = structuredClone(c.rects);
      selectSystemRects(c.rects, c.pageWidth, detectionParams[c.params]);
      expect(c.rects).toEqual(before);
    }
  });
});

describe('gapsOnPage', () => {
  for (const c of gapsOnPageCases) {
    it(caseTitle(c, 'DET-010'), () => {
      expectCloseDeep(gapsOnPage(c.systems), c.expected);
    });
  }
});

describe('median', () => {
  for (const c of medianCases) {
    it(`${c.req} ${c.id}: median of [${c.values.join(', ')}]`, () => {
      expectCloseDeep(median(c.values), c.expected);
    });
  }
});

describe('computePaddings', () => {
  for (const c of computePaddingsCases) {
    it(caseTitle(c, 'DET-010'), () => {
      expectCloseDeep(computePaddings(c.pages, c.fallbackPageHeightRatio), c.expected);
    });
  }
});

describe('paddedArea', () => {
  for (const c of paddedAreaCases) {
    it(caseTitle(c, 'DET-011'), () => {
      expectCloseDeep(paddedArea(c.box, c.padding, c.page), c.expected);
    });
  }
});
