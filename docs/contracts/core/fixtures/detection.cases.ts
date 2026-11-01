/**
 * Fixtures: core/detection (padding)
 * Requirements: DET-010, DET-011, DET-024
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Rect, Size } from '../geometry';
import type { DetectedPage } from '../model';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const gapsOnPageCases: ReadonlyArray<{ id: string; req: string; name: string; systems: Rect[]; expected: number[] }> = [
  {
    id: 'P01',
    req: 'DET-010',
    name: 'three systems',
    systems: [r(50, 100, 900, 200), r(50, 400, 900, 200), r(50, 700, 900, 200)],
    expected: [100, 100],
  },
  {
    id: 'P02',
    req: 'DET-010',
    name: 'overlapping systems give gap 0',
    systems: [r(50, 100, 900, 200), r(50, 250, 900, 200)],
    expected: [0],
  },
  {
    id: 'P03',
    req: 'DET-010',
    name: 'one system gives no gap',
    systems: [r(50, 100, 900, 200)],
    expected: [],
  },
  {
    id: 'P04',
    req: 'DET-010',
    name: 'unsorted input is sorted by y first',
    systems: [r(50, 400, 900, 200), r(50, 100, 900, 200)],
    expected: [100],
  },
];

export const medianCases: ReadonlyArray<{ id: string; req: string; values: number[]; expected: number | null }> = [
  { id: 'M01', req: 'DET-010', values: [3, 1, 2], expected: 2 },
  { id: 'M02', req: 'DET-010', values: [1, 2, 3, 4], expected: 2.5 },
  { id: 'M03', req: 'DET-010', values: [], expected: null },
  { id: 'M04', req: 'DET-010', values: [5], expected: 5 },
  { id: 'M05', req: 'DET-010', values: [10, 20, 40, 100], expected: 30 },
];

export const computePaddingsCases: ReadonlyArray<{
  id: string; req: string; name: string; pages: DetectedPage[]; fallbackPageHeightRatio: number; expected: number[];
}> = [
  {
    id: 'PD1',
    req: 'DET-010',
    name: 'own medians; single-system page uses the pooled median',
    pages: [
      {
        pageIndex: 0,
        width: 1000,
        height: 1400,
        systems: [r(50, 100, 900, 200), r(50, 400, 900, 200), r(50, 700, 900, 200)],
      },
      { pageIndex: 1, width: 1000, height: 1400, systems: [r(50, 100, 900, 200)] },
      {
        pageIndex: 2,
        width: 1000,
        height: 1400,
        systems: [r(50, 100, 900, 200), r(50, 350, 900, 200)],
      },
    ],
    fallbackPageHeightRatio: 0.02,
    expected: [100, 100, 50],
  },
  {
    id: 'PD2',
    req: 'DET-010',
    name: 'even number of gaps: mean of the middle two',
    pages: [
      {
        pageIndex: 0,
        width: 1000,
        height: 1400,
        systems: [
          r(50, 100, 900, 100),
          r(50, 210, 900, 100),
          r(50, 330, 900, 100),
          r(50, 470, 900, 100),
          r(50, 670, 900, 100),
        ],
      },
    ],
    fallbackPageHeightRatio: 0.02,
    expected: [30],
  },
  {
    id: 'PD3',
    req: 'DET-010',
    name: 'no gap anywhere: fallback ratio times each page height',
    pages: [
      { pageIndex: 0, width: 1000, height: 1400, systems: [r(50, 100, 900, 200)] },
      { pageIndex: 1, width: 1000, height: 1000, systems: [] },
    ],
    fallbackPageHeightRatio: 0.02,
    expected: [28, 20],
  },
  {
    id: 'PD4',
    req: 'DET-010',
    name: 'page without systems gets the pooled median',
    pages: [
      {
        pageIndex: 0,
        width: 1000,
        height: 1400,
        systems: [r(50, 100, 900, 200), r(50, 400, 900, 200), r(50, 700, 900, 200)],
      },
      { pageIndex: 1, width: 1000, height: 1400, systems: [] },
    ],
    fallbackPageHeightRatio: 0.02,
    expected: [100, 100],
  },
];

export const paddedAreaCases: ReadonlyArray<{
  id: string; req: string; name: string; box: Rect; padding: number; page: Size; expected: Rect;
}> = [
  {
    id: 'PA1',
    req: 'DET-011',
    name: 'inside the page',
    box: r(50, 100, 900, 200),
    padding: 30,
    page: { width: 1000, height: 1400 },
    expected: r(20, 70, 960, 260),
  },
  {
    id: 'PA2',
    req: 'DET-011',
    name: 'clamped to the page on three sides',
    box: r(10, 5, 980, 100),
    padding: 30,
    page: { width: 1000, height: 1400 },
    expected: r(0, 0, 1000, 135),
  },
  {
    id: 'PA3',
    req: 'DET-011',
    name: 'zero padding',
    box: r(50, 100, 900, 200),
    padding: 0,
    page: { width: 1000, height: 1400 },
    expected: r(50, 100, 900, 200),
  },
];
