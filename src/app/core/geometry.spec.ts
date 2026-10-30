import { describe, expect, it } from 'vitest';

import {
  bitmapRectToDisplay, displayToUser, fitScaleToPixelCap, pageDisplaySize, rectArea, rectUnion, userToDisplay,
} from './geometry';
import type { PageBox, PageRotation, Point } from './geometry';
import {
  bitmapRectToDisplayCases, fitScaleToPixelCapCases, pageDisplaySizeCases, pageTransformCases, rectAreaCases,
  rectUnionCases,
} from './fixtures/geometry.cases';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

describe('rectArea', () => {
  for (const c of rectAreaCases) {
    it(`DET-009 ${c.id}: area`, () => {
      expectCloseDeep(rectArea(c.rect), c.expected);
    });
  }
});

describe('rectUnion', () => {
  for (const c of rectUnionCases) {
    it(`DET-009 ${c.id}: union`, () => {
      expectCloseDeep(rectUnion(c.a, c.b), c.expected);
    });
  }
});

describe('bitmapRectToDisplay', () => {
  for (const c of bitmapRectToDisplayCases) {
    it(`DET-009 ${c.id}: bitmap to display`, () => {
      expectCloseDeep(bitmapRectToDisplay(c.rect, c.scale), c.expected);
    });
  }
});

describe('pageDisplaySize', () => {
  for (const c of pageDisplaySizeCases) {
    it(caseTitle(c, 'SAV-007'), () => {
      expectCloseDeep(pageDisplaySize(c.box), c.size);
    });
  }
});

describe('page transforms', () => {
  for (const c of pageTransformCases) {
    it(`${caseTitle(c, 'SAV-007')} (userToDisplay)`, () => {
      expectCloseDeep(userToDisplay(c.user, c.box), c.display);
    });
    it(`${caseTitle(c, 'SAV-007')} (displayToUser)`, () => {
      expectCloseDeep(displayToUser(c.display, c.box), c.user);
    });
  }

  const rotations: PageRotation[] = [0, 90, 180, 270];
  const points: Point[] = Array.from({ length: 20 }, (_, i) => ({ x: 7 + i * 13.5, y: 3 + i * i * 2.25 }));
  for (const rotate of rotations) {
    it(`SAV-007 round trip displayToUser(userToDisplay(p)) ≈ p for rotate ${rotate}`, () => {
      const box: PageBox = { view: [10, 20, 610.5, 812.25], rotate };
      for (const p of points) {
        expectCloseDeep(displayToUser(userToDisplay(p, box), box), p);
      }
    });
  }
});

describe('fitScaleToPixelCap', () => {
  for (const c of fitScaleToPixelCapCases) {
    it(caseTitle(c, 'NFR-006'), () => {
      expect(fitScaleToPixelCap(c.pageWidth, c.pageHeight, c.desiredScale, c.maxPixels)).toBeCloseTo(c.expected, 9);
    });
  }
});
