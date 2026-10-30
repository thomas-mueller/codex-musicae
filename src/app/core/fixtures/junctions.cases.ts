/**
 * Fixtures: core/junctions
 * Requirements: PLY-001, ORG-008, ORG-009, DET-012
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Rect } from '../geometry';
import type { Bar, DetectedPage, SystemInfo } from '../model';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const junctionCases: ReadonlyArray<{
  id: string; req: string; name: string; pages: DetectedPage[]; systems: SystemInfo[]; count: number; bars: Bar[];
}> = [
  {
    id: 'J1',
    req: 'PLY-001, ORG-008',
    name: 'two pages: junction 2 has two bars (page change)',
    pages: [
      {
        pageIndex: 0,
        width: 1000,
        height: 1400,
        systems: [r(50, 100, 900, 200), r(50, 400, 900, 180)],
      },
      { pageIndex: 1, width: 1000, height: 1400, systems: [r(50, 80, 900, 220)] },
    ],
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200) },
      { index: 2, pageIndex: 0, box: r(50, 400, 900, 180) },
      { index: 3, pageIndex: 1, box: r(50, 80, 900, 220) },
    ],
    count: 3,
    bars: [
      { junction: 0, pageIndex: 0, y: 0, height: 100 },
      { junction: 1, pageIndex: 0, y: 300, height: 100 },
      { junction: 2, pageIndex: 0, y: 580, height: 820 },
      { junction: 2, pageIndex: 1, y: 0, height: 80 },
      { junction: 3, pageIndex: 1, y: 300, height: 1100 },
    ],
  },
  {
    id: 'J2',
    req: 'ORG-009, DET-012',
    name: 'a page without systems is skipped; junction 1 is on pages 0 and 2',
    pages: [
      { pageIndex: 0, width: 1000, height: 1400, systems: [r(50, 100, 900, 200)] },
      { pageIndex: 1, width: 1000, height: 1400, systems: [] },
      { pageIndex: 2, width: 1000, height: 1400, systems: [r(50, 100, 900, 200)] },
    ],
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200) },
      { index: 2, pageIndex: 2, box: r(50, 100, 900, 200) },
    ],
    count: 2,
    bars: [
      { junction: 0, pageIndex: 0, y: 0, height: 100 },
      { junction: 1, pageIndex: 0, y: 300, height: 1100 },
      { junction: 1, pageIndex: 2, y: 0, height: 100 },
      { junction: 2, pageIndex: 2, y: 300, height: 1100 },
    ],
  },
  {
    id: 'J3',
    req: 'ORG-008',
    name: 'system at the page top: zero-height top bar is kept',
    pages: [{ pageIndex: 0, width: 1000, height: 1400, systems: [r(50, 0, 900, 200)] }],
    systems: [{ index: 1, pageIndex: 0, box: r(50, 0, 900, 200) }],
    count: 1,
    bars: [
      { junction: 0, pageIndex: 0, y: 0, height: 0 },
      { junction: 1, pageIndex: 0, y: 200, height: 1200 },
    ],
  },
  {
    id: 'J4',
    req: 'PLY-001',
    name: 'unsorted input pages and systems are sorted',
    pages: [
      { pageIndex: 1, width: 1000, height: 1400, systems: [r(50, 80, 900, 220)] },
      {
        pageIndex: 0,
        width: 1000,
        height: 1400,
        systems: [r(50, 400, 900, 180), r(50, 100, 900, 200)],
      },
    ],
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200) },
      { index: 2, pageIndex: 0, box: r(50, 400, 900, 180) },
      { index: 3, pageIndex: 1, box: r(50, 80, 900, 220) },
    ],
    count: 3,
    bars: [
      { junction: 0, pageIndex: 0, y: 0, height: 100 },
      { junction: 1, pageIndex: 0, y: 300, height: 100 },
      { junction: 2, pageIndex: 0, y: 580, height: 820 },
      { junction: 2, pageIndex: 1, y: 0, height: 80 },
      { junction: 3, pageIndex: 1, y: 300, height: 1100 },
    ],
  },
  {
    id: 'J5',
    req: 'ORG-009',
    name: 'no systems anywhere: no bars, N = 0',
    pages: [{ pageIndex: 0, width: 1000, height: 1400, systems: [] }],
    systems: [],
    count: 0,
    bars: [],
  },
];

/** barsOfJunction on the bars of case J1. */
export const barsOfJunctionCases: ReadonlyArray<{ id: string; from: string; junction: number; expected: Bar[] }> = [
  {
    id: 'JB1',
    from: 'J1',
    junction: 0,
    expected: [{ junction: 0, pageIndex: 0, y: 0, height: 100 }],
  },
  {
    id: 'JB2',
    from: 'J1',
    junction: 2,
    expected: [
      { junction: 2, pageIndex: 0, y: 580, height: 820 },
      { junction: 2, pageIndex: 1, y: 0, height: 80 },
    ],
  },
  {
    id: 'JB3',
    from: 'J1',
    junction: 3,
    expected: [{ junction: 3, pageIndex: 1, y: 300, height: 1100 }],
  },
  { id: 'JB4', from: 'J1', junction: 9, expected: [] },
];
