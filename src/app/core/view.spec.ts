import { describe, expect, it } from 'vitest';

import {
  clampPanCases,
  fitScaleCases,
  layoutPagesCases,
  orgZoomLimitsCases,
  pageAtOffsetCases,
  scrollAfterZoomCases,
  tilesCoveringCases,
  zoomAroundCases,
} from './fixtures/view.cases';
import { clampPan, fitScale, layoutPages, orgZoomLimits, pageAtOffset, scrollAfterZoom, tilesCovering, zoomAround } from './view';

const DIGITS = 9;

describe('fitScale', () => {
  for (const c of fitScaleCases) {
    it(`${c.req} ${c.id}: ${c.mode}`, () => {
      expect(fitScale(c.content, c.viewport, c.mode)).toBeCloseTo(c.expected, DIGITS);
    });
  }
});

describe('orgZoomLimits', () => {
  for (const c of orgZoomLimitsCases) {
    it(`${c.req} ${c.id}`, () => {
      const limits = orgZoomLimits(c.page, c.viewport, c.maxZoom);
      expect(limits.min).toBeCloseTo(c.expected.min, DIGITS);
      expect(limits.max).toBeCloseTo(c.expected.max, DIGITS);
    });
  }
});

describe('scrollAfterZoom', () => {
  for (const c of scrollAfterZoomCases) {
    it(`${c.req} ${c.id}`, () => {
      const result = scrollAfterZoom(c.scroll, c.anchor, c.oldZoom, c.newZoom);
      expect(result.x).toBeCloseTo(c.expected.x, DIGITS);
      expect(result.y).toBeCloseTo(c.expected.y, DIGITS);
    });
  }
});

describe('layoutPages', () => {
  for (const c of layoutPagesCases) {
    it(`${c.req} ${c.id}`, () => {
      const layout = layoutPages(c.sizes, c.scale, c.gap);
      expect(layout).toHaveLength(c.expected.length);
      for (const [i, want] of c.expected.entries()) {
        const got = layout[i];
        expect(got?.top).toBeCloseTo(want.top, DIGITS);
        expect(got?.height).toBeCloseTo(want.height, DIGITS);
        expect(got?.width).toBeCloseTo(want.width, DIGITS);
      }
    });
  }
});

describe('pageAtOffset', () => {
  for (const c of pageAtOffsetCases) {
    it(`${c.req} ${c.id}: y=${c.y}`, () => {
      const source = layoutPagesCases.find((l) => l.id === c.layoutFrom);
      expect(source).toBeDefined();
      expect(pageAtOffset(source!.expected, c.y, c.gap)).toBe(c.expected);
    });
  }
});

describe('clampPan', () => {
  for (const c of clampPanCases) {
    it(`${c.req} ${c.id}`, () => {
      const view = clampPan(c.view, c.fitted, c.viewport);
      expect(view.zoom).toBeCloseTo(c.expected.zoom, DIGITS);
      expect(view.panX).toBeCloseTo(c.expected.panX, DIGITS);
      expect(view.panY).toBeCloseTo(c.expected.panY, DIGITS);
    });
  }
});

describe('zoomAround', () => {
  for (const c of zoomAroundCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const view = zoomAround(c.view, c.factor, c.anchor, c.limits, c.fitted, c.viewport);
      expect(view.zoom).toBeCloseTo(c.expected.zoom, DIGITS);
      expect(view.panX).toBeCloseTo(c.expected.panX, DIGITS);
      expect(view.panY).toBeCloseTo(c.expected.panY, DIGITS);
    });
  }
});

describe('tilesCovering', () => {
  for (const c of tilesCoveringCases) {
    it(`NFR-007 ${c.id}: ${c.name}`, () => {
      const tiles = tilesCovering(c.visible, c.content, c.tileSize);
      expect(tiles).toHaveLength(c.expected.length);
      for (const [i, want] of c.expected.entries()) {
        const got = tiles[i];
        expect(got?.x).toBeCloseTo(want.x, DIGITS);
        expect(got?.y).toBeCloseTo(want.y, DIGITS);
        expect(got?.width).toBeCloseTo(want.width, DIGITS);
        expect(got?.height).toBeCloseTo(want.height, DIGITS);
      }
    });
  }
});
