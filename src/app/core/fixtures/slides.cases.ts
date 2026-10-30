/**
 * Fixtures: core/slides
 * Requirements: SLD-001..SLD-006, SLD-012
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Rect } from '../geometry';
import type { PackInput, SlidePlan, SystemGeom } from '../slides';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
void r;

/**
 * Document used by all packing cases: 2 pages (1000 x 1400), systems 900 x 200 at x = 50,
 * page 0 systems 1..3 at y = 100, 400, 700; page 1 systems 4..6 at the same y; padding 20 (padded height 240,
 * padded width 940 => W_ref = 940). Adjacent same-page systems merge: 2 systems = 540 high, 3 systems = 840 high.
 */
export const packingSystems: SystemGeom[] = [
  { index: 1, pageIndex: 0, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
  { index: 2, pageIndex: 0, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
  { index: 3, pageIndex: 0, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
  { index: 4, pageIndex: 1, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
  { index: 5, pageIndex: 1, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
  { index: 6, pageIndex: 1, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
];

export const referenceWidthCases: ReadonlyArray<{ id: string; req: string; systems: SystemGeom[]; expected: number }> = [
  {
    id: 'SR1',
    req: 'SLD-002',
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 2, pageIndex: 0, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 3, pageIndex: 0, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
      { index: 4, pageIndex: 1, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 5, pageIndex: 1, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 6, pageIndex: 1, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
    ],
    expected: 940,
  },
  {
    id: 'SR2',
    req: 'SLD-002',
    systems: [
      { index: 1, pageIndex: 0, box: r(0, 0, 10, 10), padded: r(0, 0, 900, 10) },
      { index: 2, pageIndex: 0, box: r(0, 0, 10, 10), padded: r(0, 0, 940, 10) },
      { index: 3, pageIndex: 0, box: r(0, 0, 10, 10), padded: r(0, 0, 920, 10) },
    ],
    expected: 940,
  },
];

export const packSlidesCases: ReadonlyArray<{ id: string; req: string; name: string; input: PackInput; expected: SlidePlan[] }> = [
  {
    id: 'SP01',
    req: 'SLD-003, SLD-004',
    name: 'r = 1.0 (H = 940): three adjacent systems merge into one region; the next page starts a new slide',
    input: {
      entries: [1, 2, 3, 4, 5, 6],
      forcedBreakAfter: [false, false, false, false, false],
      slideWidth: 940,
      aspectRatio: 1,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 2,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 3,
            area: r(30, 80, 940, 840),
            entryStart: 0,
            entryEnd: 2,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 840,
        enlarged: false,
      },
      {
        entryStart: 3,
        entryEnd: 5,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 6,
            area: r(30, 80, 940, 840),
            entryStart: 3,
            entryEnd: 5,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 840,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP02',
    req: 'SLD-003, SLD-005',
    name: 'r = 1.5 (H = 626.67): regions from different pages stack directly',
    input: {
      entries: [1, 2, 3, 4, 5, 6],
      forcedBreakAfter: [false, false, false, false, false],
      slideWidth: 940,
      aspectRatio: 1.5,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 1,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 2,
            area: r(30, 80, 940, 540),
            entryStart: 0,
            entryEnd: 1,
          },
        ],
        width: 940,
        height: 626.6666666666666,
        stackHeight: 540,
        enlarged: false,
      },
      {
        entryStart: 2,
        entryEnd: 3,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 3,
            lastSystem: 3,
            area: r(30, 680, 940, 240),
            entryStart: 2,
            entryEnd: 2,
          },
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 4,
            area: r(30, 80, 940, 240),
            entryStart: 3,
            entryEnd: 3,
          },
        ],
        width: 940,
        height: 626.6666666666666,
        stackHeight: 480,
        enlarged: false,
      },
      {
        entryStart: 4,
        entryEnd: 5,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 5,
            lastSystem: 6,
            area: r(30, 380, 940, 540),
            entryStart: 4,
            entryEnd: 5,
          },
        ],
        width: 940,
        height: 626.6666666666666,
        stackHeight: 540,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP03',
    req: 'SLD-003, PLY-011',
    name: 'a forced break after the first entry',
    input: {
      entries: [1, 2, 3, 4, 5, 6],
      forcedBreakAfter: [true, false, false, false, false],
      slideWidth: 940,
      aspectRatio: 1,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 0,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 1,
            area: r(30, 80, 940, 240),
            entryStart: 0,
            entryEnd: 0,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 240,
        enlarged: false,
      },
      {
        entryStart: 1,
        entryEnd: 3,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 2,
            lastSystem: 3,
            area: r(30, 380, 940, 540),
            entryStart: 1,
            entryEnd: 2,
          },
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 4,
            area: r(30, 80, 940, 240),
            entryStart: 3,
            entryEnd: 3,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 780,
        enlarged: false,
      },
      {
        entryStart: 4,
        entryEnd: 5,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 5,
            lastSystem: 6,
            area: r(30, 380, 940, 540),
            entryStart: 4,
            entryEnd: 5,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 540,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP04',
    req: 'SLD-006',
    name: 'r = 5 (H = 188 < 240): every slide is enlarged and holds one entry',
    input: {
      entries: [1, 2, 3, 4, 5, 6],
      forcedBreakAfter: [false, false, false, false, false],
      slideWidth: 940,
      aspectRatio: 5,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 0,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 1,
            area: r(30, 80, 940, 240),
            entryStart: 0,
            entryEnd: 0,
          },
        ],
        width: 1200,
        height: 240,
        stackHeight: 240,
        enlarged: true,
      },
      {
        entryStart: 1,
        entryEnd: 1,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 2,
            lastSystem: 2,
            area: r(30, 380, 940, 240),
            entryStart: 1,
            entryEnd: 1,
          },
        ],
        width: 1200,
        height: 240,
        stackHeight: 240,
        enlarged: true,
      },
      {
        entryStart: 2,
        entryEnd: 2,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 3,
            lastSystem: 3,
            area: r(30, 680, 940, 240),
            entryStart: 2,
            entryEnd: 2,
          },
        ],
        width: 1200,
        height: 240,
        stackHeight: 240,
        enlarged: true,
      },
      {
        entryStart: 3,
        entryEnd: 3,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 4,
            area: r(30, 80, 940, 240),
            entryStart: 3,
            entryEnd: 3,
          },
        ],
        width: 1200,
        height: 240,
        stackHeight: 240,
        enlarged: true,
      },
      {
        entryStart: 4,
        entryEnd: 4,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 5,
            lastSystem: 5,
            area: r(30, 380, 940, 240),
            entryStart: 4,
            entryEnd: 4,
          },
        ],
        width: 1200,
        height: 240,
        stackHeight: 240,
        enlarged: true,
      },
      {
        entryStart: 5,
        entryEnd: 5,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 6,
            lastSystem: 6,
            area: r(30, 680, 940, 240),
            entryStart: 5,
            entryEnd: 5,
          },
        ],
        width: 1200,
        height: 240,
        stackHeight: 240,
        enlarged: true,
      },
    ],
  },
  {
    id: 'SP05',
    req: 'SLD-004, SLD-005',
    name: 'repeat order [1,2,1,2,3,4]: system 1 after system 2 is not adjacent',
    input: {
      entries: [1, 2, 1, 2, 3, 4],
      forcedBreakAfter: [false, false, false, false, false],
      slideWidth: 940,
      aspectRatio: 1,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 2,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 2,
            area: r(30, 80, 940, 540),
            entryStart: 0,
            entryEnd: 1,
          },
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 1,
            area: r(30, 80, 940, 240),
            entryStart: 2,
            entryEnd: 2,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 780,
        enlarged: false,
      },
      {
        entryStart: 3,
        entryEnd: 5,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 2,
            lastSystem: 3,
            area: r(30, 380, 940, 540),
            entryStart: 3,
            entryEnd: 4,
          },
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 4,
            area: r(30, 80, 940, 240),
            entryStart: 5,
            entryEnd: 5,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 780,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP06',
    req: 'SLD-005',
    name: 'jump order [1,2,5,6]',
    input: {
      entries: [1, 2, 5, 6],
      forcedBreakAfter: [false, false, false],
      slideWidth: 940,
      aspectRatio: 1,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 2,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 2,
            area: r(30, 80, 940, 540),
            entryStart: 0,
            entryEnd: 1,
          },
          {
            pageIndex: 1,
            firstSystem: 5,
            lastSystem: 5,
            area: r(30, 380, 940, 240),
            entryStart: 2,
            entryEnd: 2,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 780,
        enlarged: false,
      },
      {
        entryStart: 3,
        entryEnd: 3,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 6,
            lastSystem: 6,
            area: r(30, 680, 940, 240),
            entryStart: 3,
            entryEnd: 3,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 240,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP07',
    req: 'SLD-003',
    name: 'a single entry',
    input: { entries: [3], forcedBreakAfter: [], slideWidth: 940, aspectRatio: 1, systems: packingSystems },
    expected: [
      {
        entryStart: 0,
        entryEnd: 0,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 3,
            lastSystem: 3,
            area: r(30, 680, 940, 240),
            entryStart: 0,
            entryEnd: 0,
          },
        ],
        width: 940,
        height: 940,
        stackHeight: 240,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP08',
    req: 'SLD-003',
    name: 'no entries give no slides',
    input: { entries: [], forcedBreakAfter: [], slideWidth: 940, aspectRatio: 1, systems: packingSystems },
    expected: [],
  },
  {
    id: 'SP09',
    req: 'SLD-003',
    name: 'r = 0.5 (H = 1880): everything fits on one slide',
    input: {
      entries: [1, 2, 3, 4, 5, 6],
      forcedBreakAfter: [false, false, false, false, false],
      slideWidth: 940,
      aspectRatio: 0.5,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 5,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 3,
            area: r(30, 80, 940, 840),
            entryStart: 0,
            entryEnd: 2,
          },
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 6,
            area: r(30, 80, 940, 840),
            entryStart: 3,
            entryEnd: 5,
          },
        ],
        width: 940,
        height: 1880,
        stackHeight: 1680,
        enlarged: false,
      },
    ],
  },
  {
    id: 'SP10',
    req: 'SLD-003',
    name: 'boundary: stack exactly equal to H fits (r = 940 / 840)',
    input: {
      entries: [1, 2, 3, 4],
      forcedBreakAfter: [false, false, false],
      slideWidth: 940,
      aspectRatio: 1.119047619047619,
      systems: packingSystems,
    },
    expected: [
      {
        entryStart: 0,
        entryEnd: 2,
        regions: [
          {
            pageIndex: 0,
            firstSystem: 1,
            lastSystem: 3,
            area: r(30, 80, 940, 840),
            entryStart: 0,
            entryEnd: 2,
          },
        ],
        width: 940,
        height: 840,
        stackHeight: 840,
        enlarged: false,
      },
      {
        entryStart: 3,
        entryEnd: 3,
        regions: [
          {
            pageIndex: 1,
            firstSystem: 4,
            lastSystem: 4,
            area: r(30, 80, 940, 240),
            entryStart: 3,
            entryEnd: 3,
          },
        ],
        width: 940,
        height: 840,
        stackHeight: 240,
        enlarged: false,
      },
    ],
  },
];

/** slideIndexOfEntry on the slides of case SP02. */
export const slideIndexOfEntryCases: ReadonlyArray<{ id: string; req: string; entryIndex: number; expected: number }> = [
  { id: 'SI1', req: 'SLD-012', entryIndex: 0, expected: 0 },
  { id: 'SI2', req: 'SLD-012', entryIndex: 1, expected: 0 },
  { id: 'SI3', req: 'SLD-012', entryIndex: 2, expected: 1 },
  { id: 'SI4', req: 'SLD-012', entryIndex: 3, expected: 1 },
  { id: 'SI5', req: 'SLD-012', entryIndex: 4, expected: 2 },
  { id: 'SI6', req: 'SLD-012', entryIndex: 5, expected: 2 },
  { id: 'SI7', req: 'SLD-012', entryIndex: 6, expected: -1 },
  { id: 'SI8', req: 'SLD-012', entryIndex: -1, expected: -1 },
];
