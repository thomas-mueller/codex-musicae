import { invariantProblems, isDisplayed, pageAtOffset, type Invariants } from '../../scripts/lib/load-checks.mjs';

const FINE: Invariants = {
  cacheBytes: 90,
  cacheBudgetBytes: 100,
  canvasPixels: [10, 50],
  maxCanvasPixels: 60,
  heapMb: 200,
  maxHeapMb: 400,
  peakPerClass: { visible: 1, detection: 2 },
  maxPerClass: 2,
};

describe('load suite checks', () => {
  it('TST-025 the page at an offset is the one whose span contains it; the end of a page belongs to the next', () => {
    const pages = [{ top: 0, height: 100 }, { top: 110, height: 100 }];
    expect(pageAtOffset(pages, 0)).toBe(0);
    expect(pageAtOffset(pages, 99.9)).toBe(0);
    expect(pageAtOffset(pages, 100)).toBe(-1); // the gap between pages
    expect(pageAtOffset(pages, 110)).toBe(1);
    expect(pageAtOffset(pages, 210)).toBe(-1);
  });

  it('TST-025 a page is displayed when its drawn share reaches the minimum', () => {
    expect(isDisplayed(0.9, 0.9)).toBe(true);
    expect(isDisplayed(0.89, 0.9)).toBe(false);
  });

  it('TST-025 holding invariants give no problem, even without canvases or scheduler classes', () => {
    expect(invariantProblems(FINE)).toEqual([]);
    expect(invariantProblems({ ...FINE, cacheBytes: 100, canvasPixels: [], peakPerClass: {} })).toEqual([]);
  });

  it('TST-025 each breach is one problem: cache, canvas, heap, tasks per class', () => {
    expect(invariantProblems({ ...FINE, cacheBytes: 101 })).toHaveLength(1);
    expect(invariantProblems({ ...FINE, canvasPixels: [10, 61] })).toHaveLength(1);
    expect(invariantProblems({ ...FINE, heapMb: 401 })).toHaveLength(1);
    expect(invariantProblems({ ...FINE, peakPerClass: { visible: 3, detection: 3 } })).toHaveLength(2);
    expect(invariantProblems({ ...FINE, cacheBytes: 101, heapMb: 401 })).toHaveLength(2);
  });
});
