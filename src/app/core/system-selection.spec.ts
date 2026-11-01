import { describe, expect, it } from 'vitest';

import { areaThreshold, selectSystems, shouldSelectComponent } from './system-selection';
import type { ConnectedComponent, SelectionParams } from './system-selection';

/** The width limits of the `fast` level: 0.5 / 0.75. */
const LIMITS: SelectionParams = { minSystemWidthRatio: 0.5, fullWidthSystemRatio: 0.75 };
const component = (x: number, y: number, width: number, height: number, area: number): ConnectedComponent => ({ rect: { x, y, width, height }, area });

describe('shouldSelectComponent', () => {
  const canvasWidth = 1000;
  const threshold = 500;

  it('DET-007 rejects boxes below the minimum width', () => {
    expect(shouldSelectComponent(1000, canvasWidth * 0.49, canvasWidth, threshold, LIMITS)).toBe(false);
  });

  it('DET-006 requires the area threshold for boxes between the width limits (strictly greater)', () => {
    expect(shouldSelectComponent(500, canvasWidth * 0.6, canvasWidth, threshold, LIMITS)).toBe(false);
    expect(shouldSelectComponent(501, canvasWidth * 0.6, canvasWidth, threshold, LIMITS)).toBe(true);
  });

  it('DET-008 always selects boxes at the forced width', () => {
    expect(shouldSelectComponent(1, canvasWidth * LIMITS.fullWidthSystemRatio, canvasWidth, threshold, LIMITS)).toBe(true);
  });

  it('DET-007 a box exactly at the minimum width is not rejected', () => {
    expect(shouldSelectComponent(501, canvasWidth * 0.5, canvasWidth, threshold, LIMITS)).toBe(true);
  });
});

describe('areaThreshold', () => {
  it('DET-006 no or one component gives threshold 0', () => {
    expect(areaThreshold([])).toBe(0);
    expect(areaThreshold([42])).toBe(0);
  });

  it('DET-006 the threshold is the smaller area after the largest gap of the descending areas', () => {
    expect(areaThreshold([10, 9000, 8800, 30, 9200])).toBe(30); // 9200 9000 8800 | 30 10: the gap 8800 -> 30 is the largest
  });

  it('DET-006 among equal largest gaps the first one from the large end decides', () => {
    expect(areaThreshold([100, 80, 60, 40])).toBe(80); // gaps 20, 20, 20 -> the first: threshold = 80
  });

  it('DET-006 equal areas give the second-largest area, so only strictly larger components pass the area rule', () => {
    expect(areaThreshold([50, 50, 50])).toBe(50);
  });
});

describe('selectSystems', () => {
  const bitmap = { width: 1000, height: 1000 };
  const page = { width: 500, height: 800 };

  it('DET-005 no components give no systems', () => {
    expect(selectSystems([], bitmap, page, LIMITS)).toEqual([]);
  });

  it('DET-006 DET-007 keeps the wide components above the gap and drops small ones and narrow ones', () => {
    const systems = selectSystems(
      [
        component(100, 600, 800, 100, 9000), // wide, above the gap: kept
        component(100, 100, 800, 100, 8800), // wide, above the gap: kept
        component(300, 300, 20, 20, 30), // a note: below the gap and narrow
        component(100, 450, 400, 60, 40), // exactly 0.4 wide: below the minimum
      ],
      bitmap,
      page,
      LIMITS,
    );
    expect(systems).toHaveLength(2);
  });

  it('DET-008 a component at the forced width is kept although its area is below the threshold', () => {
    const systems = selectSystems([component(0, 0, 900, 50, 100), component(0, 100, 900, 50, 90), component(0, 200, 10, 10, 5)], bitmap, page, LIMITS);
    // areas 100 90 5: the largest gap is 90 -> 5, threshold 5: both wide ones pass (and the tiny one is too narrow).
    expect(systems).toHaveLength(2);
    const forced = selectSystems([component(0, 0, 900, 50, 10), component(0, 100, 100, 50, 1000), component(0, 200, 100, 50, 900)], bitmap, page, LIMITS);
    expect(forced).toHaveLength(1); // the wide component has the smallest area but is forced; the others are narrower than 0.5
  });

  it('DET-009 boxes are normalized by the bitmap size, converted to page points and sorted top to bottom, ties left to right', () => {
    const systems = selectSystems(
      [component(500, 200, 500, 100, 7000), component(0, 200, 500, 100, 7000), component(0, 600, 1000, 100, 9000), component(5, 5, 5, 5, 10)],
      bitmap,
      page,
      LIMITS,
    ); // areas 9000 7000 7000 10: the threshold is 10
    expect(systems).toEqual([
      { x: 0, y: 160, width: 250, height: 80 },
      { x: 250, y: 160, width: 250, height: 80 },
      { x: 0, y: 480, width: 500, height: 80 },
    ]);
  });

  it('DET-006 uses pixel areas, not the area of the bounding box (a large frame with little ink is still compared by its ink)', () => {
    const systems = selectSystems(
      [component(0, 0, 600, 900, 100), component(0, 100, 600, 100, 6000), component(0, 300, 600, 100, 6200)],
      bitmap,
      page,
      LIMITS,
    );
    // areas 6200 6000 100: largest gap 6000 -> 100: threshold 100: the two systems pass, the frame (area 100) does not.
    expect(systems.map((s) => s.y)).toEqual([80, 240]);
  });

  it('DET-005 does not modify its input array or its components', () => {
    const input = [component(0, 600, 900, 50, 5000), component(0, 100, 900, 50, 4000), component(5, 5, 5, 5, 10)];
    const copy = structuredClone(input);
    selectSystems(input, bitmap, page, LIMITS);
    expect(input).toEqual(copy);
  });
});
