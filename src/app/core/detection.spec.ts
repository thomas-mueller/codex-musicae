import { describe, it } from 'vitest';

import { computePaddings, gapsOnPage, median, paddedArea } from './detection';
import {
  computePaddingsCases, gapsOnPageCases, medianCases, paddedAreaCases,
} from './fixtures/detection.cases';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

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
