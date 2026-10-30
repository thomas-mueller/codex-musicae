/**
 * Fixtures: core/detection
 * Requirements: DET-005..DET-011, DET-024
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Rect, Size } from '../geometry';
import type { DetectedPage } from '../model';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const detectionParams = {
  standard: { minSystemWidthRatio: 0.5, fullWidthSystemRatio: 0.75 },
  fast: { minSystemWidthRatio: 0.6, fullWidthSystemRatio: 0.8 },
} as const;

export const selectSystemRectsCases: ReadonlyArray<{
  id: string; req: string; name: string; pageWidth: number; params: keyof typeof detectionParams; rects: Rect[]; expected: Rect[];
}> = [
  {
    id: 'D01',
    req: 'DET-006',
    name: 'typical page, unsorted input, noise removed',
    pageWidth: 1000,
    params: 'standard',
    rects: [
      r(50, 700, 880, 210),
      r(60, 120, 30, 40),
      r(300, 130, 20, 60),
      r(500, 150, 10, 90),
      r(0, 0, 1000, 1400),
      r(50, 100, 900, 200),
      r(50, 400, 900, 180),
    ],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(50, 700, 880, 210)],
  },
  {
    id: 'D02',
    req: 'DET-005',
    name: 'only the page rectangle gives no systems',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400)],
    expected: [],
  },
  {
    id: 'D03',
    req: 'DET-005',
    name: 'empty input gives no systems',
    pageWidth: 1000,
    params: 'standard',
    rects: [],
    expected: [],
  },
  {
    id: 'D04',
    req: 'DET-007',
    name: 'a single narrow rectangle is dropped by the 50% rule',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400), r(100, 100, 400, 300)],
    expected: [],
  },
  {
    id: 'D05',
    req: 'DET-006',
    name: 'a single wide rectangle survives (threshold 0)',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400), r(50, 100, 900, 200)],
    expected: [r(50, 100, 900, 200)],
  },
  {
    id: 'D06',
    req: 'DET-008',
    name: 'flat single-line system below the area threshold is rescued by the full-width rule',
    pageWidth: 1000,
    params: 'standard',
    rects: [
      r(0, 0, 1000, 1400),
      r(50, 100, 900, 200),
      r(50, 400, 900, 180),
      r(50, 700, 880, 210),
      r(50, 950, 900, 30),
      r(60, 120, 30, 40),
      r(300, 130, 20, 60),
      r(500, 150, 10, 90),
    ],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(50, 700, 880, 210), r(50, 950, 900, 30)],
  },
  {
    id: 'D07',
    req: 'DET-007',
    name: 'wide-area but narrow title block is removed',
    pageWidth: 1000,
    params: 'standard',
    rects: [
      r(0, 0, 1000, 1400),
      r(100, 20, 300, 300),
      r(50, 100, 900, 200),
      r(50, 400, 900, 180),
      r(50, 700, 880, 210),
      r(60, 120, 30, 40),
      r(300, 130, 20, 60),
      r(500, 150, 10, 90),
    ],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(50, 700, 880, 210)],
  },
  {
    id: 'D08',
    req: 'DET-006',
    name: 'all remaining areas equal: threshold 0, all kept',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400), r(50, 100, 900, 200), r(50, 400, 900, 200), r(50, 700, 900, 200)],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 200), r(50, 700, 900, 200)],
  },
  {
    id: 'D09',
    req: 'DET-005',
    name: 'two page-sized rectangles: only one is dropped, the other stays (known limitation LIM-002)',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400), r(0, 0, 1000, 1400), r(50, 100, 900, 200), r(50, 400, 900, 180)],
    expected: [r(0, 0, 1000, 1400), r(50, 100, 900, 200), r(50, 400, 900, 180)],
  },
  {
    id: 'D10',
    req: 'DET-007',
    name: 'width exactly 50% of the page stays',
    pageWidth: 1000,
    params: 'standard',
    rects: [
      r(0, 0, 1000, 1400),
      r(100, 100, 500, 300),
      r(100, 500, 500, 280),
      r(60, 120, 30, 40),
      r(300, 130, 20, 60),
      r(500, 150, 10, 90),
    ],
    expected: [r(100, 100, 500, 300), r(100, 500, 500, 280)],
  },
  {
    id: 'D11',
    req: 'DET-007',
    name: 'level standard: a 550 wide rectangle stays',
    pageWidth: 1000,
    params: 'standard',
    rects: [
      r(0, 0, 1000, 1400),
      r(50, 100, 900, 200),
      r(50, 400, 900, 180),
      r(50, 700, 880, 210),
      r(100, 950, 550, 250),
      r(60, 120, 30, 40),
      r(300, 130, 20, 60),
      r(500, 150, 10, 90),
    ],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(50, 700, 880, 210), r(100, 950, 550, 250)],
  },
  {
    id: 'D12',
    req: 'DET-007',
    name: 'level fast: the same 550 wide rectangle is dropped',
    pageWidth: 1000,
    params: 'fast',
    rects: [
      r(0, 0, 1000, 1400),
      r(50, 100, 900, 200),
      r(50, 400, 900, 180),
      r(50, 700, 880, 210),
      r(100, 950, 550, 250),
      r(60, 120, 30, 40),
      r(300, 130, 20, 60),
      r(500, 150, 10, 90),
    ],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(50, 700, 880, 210)],
  },
  {
    id: 'D13',
    req: 'DET-009',
    name: 'sorting: y ascending, ties by x ascending',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400), r(100, 100, 900, 200), r(50, 400, 900, 200), r(0, 100, 900, 200)],
    expected: [r(0, 100, 900, 200), r(100, 100, 900, 200), r(50, 400, 900, 200)],
  },
  {
    id: 'D14',
    req: 'DET-005',
    name: 'zero-height rectangle is ignored',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(0, 0, 1000, 1400), r(50, 100, 900, 0), r(50, 100, 900, 200), r(50, 400, 900, 180)],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180)],
  },
  {
    id: 'D15',
    req: 'DET-005',
    name: 'the page rectangle may appear anywhere in the input',
    pageWidth: 1000,
    params: 'standard',
    rects: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(0, 0, 1000, 1400), r(50, 700, 880, 210)],
    expected: [r(50, 100, 900, 200), r(50, 400, 900, 180), r(50, 700, 880, 210)],
  },
];

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
