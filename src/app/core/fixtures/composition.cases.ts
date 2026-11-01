/**
 * Fixtures: core/composition
 * Requirements: SLD-006..SLD-010
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Rect, Size } from '../geometry';
import type { SlideComposition } from '../composition';
import type { SlidePlan, SystemGeom } from '../slides';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const composeSlideCases: ReadonlyArray<{
  id: string; req: string; name: string; systems: SystemGeom[]; pages: Size[]; plan: SlidePlan; expected: SlideComposition;
}> = [
  {
    id: 'CP01',
    req: 'SLD-007',
    name: 'SP02 slide 1: two merged systems centered, both fillers, no other systems nearby',
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 2, pageIndex: 0, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 3, pageIndex: 0, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
      { index: 4, pageIndex: 1, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 5, pageIndex: 1, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 6, pageIndex: 1, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
    ],
    pages: [{ width: 1000, height: 1400 }, { width: 1000, height: 1400 }],
    plan: {
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
    expected: {
      width: 940,
      height: 626.6666666666666,
      stackTop: 43.333333333333314,
      contents: [
        {
          kind: 'region',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 80, 940, 540),
          dest: r(0, 43.333333333333314, 940, 540),
        },
        {
          kind: 'filler-top',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 36.666666666666686, 940, 43.333333333333314),
          dest: r(0, 0, 940, 43.333333333333314),
        },
        {
          kind: 'filler-bottom',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 620, 940, 43.33333333333337),
          dest: r(0, 583.3333333333333, 940, 43.33333333333337),
        },
      ],
      overlays: [],
    },
  },
  {
    id: 'CP02',
    req: 'SLD-008, SLD-009',
    name: 'SP02 slide 2: regions of two pages; overlays where filler shows system 2 (top) and system 5 (bottom)',
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 2, pageIndex: 0, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 3, pageIndex: 0, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
      { index: 4, pageIndex: 1, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 5, pageIndex: 1, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 6, pageIndex: 1, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
    ],
    pages: [{ width: 1000, height: 1400 }, { width: 1000, height: 1400 }],
    plan: {
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
    expected: {
      width: 940,
      height: 626.6666666666666,
      stackTop: 73.33333333333331,
      contents: [
        {
          kind: 'region',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 680, 940, 240),
          dest: r(0, 73.33333333333331, 940, 240),
        },
        {
          kind: 'region',
          regionIndex: 1,
          pageIndex: 1,
          source: r(30, 80, 940, 240),
          dest: r(0, 313.3333333333333, 940, 240),
        },
        {
          kind: 'filler-top',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 606.6666666666667, 940, 73.33333333333326),
          dest: r(0, 0, 940, 73.33333333333326),
        },
        {
          kind: 'filler-bottom',
          regionIndex: 1,
          pageIndex: 1,
          source: r(30, 320, 940, 73.33333333333337),
          dest: r(0, 553.3333333333333, 940, 73.33333333333337),
        },
      ],
      overlays: [r(0, 0, 940, 13.333333333333258), r(0, 613.3333333333333, 940, 13.333333333333371)],
    },
  },
  {
    id: 'CP03',
    req: 'SLD-006, SLD-008',
    name: 'SP04 slide 1 (enlarged 1200 x 240): no vertical filler, side filler clipped to the page, grey beyond',
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 2, pageIndex: 0, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 3, pageIndex: 0, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
      { index: 4, pageIndex: 1, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 5, pageIndex: 1, box: r(50, 400, 900, 200), padded: r(30, 380, 940, 240) },
      { index: 6, pageIndex: 1, box: r(50, 700, 900, 200), padded: r(30, 680, 940, 240) },
    ],
    pages: [{ width: 1000, height: 1400 }, { width: 1000, height: 1400 }],
    plan: {
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
    expected: {
      width: 1200,
      height: 240,
      stackTop: 0,
      contents: [
        {
          kind: 'region',
          regionIndex: 0,
          pageIndex: 0,
          source: r(0, 80, 1000, 240),
          dest: r(100, 0, 1000, 240),
        },
      ],
      overlays: [],
    },
  },
  {
    id: 'CP04',
    req: 'SLD-008',
    name: 'region touching the page top: no top filler content (source outside the page)',
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 10, 900, 200), padded: r(30, 0, 940, 230) },
      { index: 2, pageIndex: 0, box: r(50, 300, 900, 200), padded: r(30, 280, 940, 240) },
    ],
    pages: [{ width: 1000, height: 1400 }],
    plan: {
      entryStart: 0,
      entryEnd: 1,
      regions: [
        {
          pageIndex: 0,
          firstSystem: 1,
          lastSystem: 2,
          area: r(30, 0, 940, 520),
          entryStart: 0,
          entryEnd: 1,
        },
      ],
      width: 940,
      height: 940,
      stackHeight: 520,
      enlarged: false,
    },
    expected: {
      width: 940,
      height: 940,
      stackTop: 210,
      contents: [
        {
          kind: 'region',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 0, 940, 520),
          dest: r(0, 210, 940, 520),
        },
        {
          kind: 'filler-bottom',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 520, 940, 210),
          dest: r(0, 730, 940, 210),
        },
      ],
      overlays: [],
    },
  },
  {
    id: 'CP05',
    req: 'SLD-008',
    name: 'region touching the page bottom: no bottom filler content',
    systems: [{ index: 1, pageIndex: 0, box: r(50, 760, 900, 220), padded: r(30, 740, 940, 260) }],
    pages: [{ width: 1000, height: 1000 }],
    plan: {
      entryStart: 0,
      entryEnd: 0,
      regions: [
        {
          pageIndex: 0,
          firstSystem: 1,
          lastSystem: 1,
          area: r(30, 740, 940, 260),
          entryStart: 0,
          entryEnd: 0,
        },
      ],
      width: 940,
      height: 940,
      stackHeight: 260,
      enlarged: false,
    },
    expected: {
      width: 940,
      height: 940,
      stackTop: 340,
      contents: [
        {
          kind: 'region',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 740, 940, 260),
          dest: r(0, 340, 940, 260),
        },
        {
          kind: 'filler-top',
          regionIndex: 0,
          pageIndex: 0,
          source: r(30, 400, 940, 340),
          dest: r(0, 0, 940, 340),
        },
      ],
      overlays: [],
    },
  },
  {
    id: 'CP06',
    req: 'SLD-008, SLD-009',
    name: 'narrow off-center system: side filler clipped at the page edge, overlay for system 1 in the top filler',
    systems: [
      { index: 1, pageIndex: 0, box: r(50, 100, 900, 200), padded: r(30, 80, 940, 240) },
      { index: 2, pageIndex: 0, box: r(300, 400, 500, 200), padded: r(280, 380, 540, 240) },
    ],
    pages: [{ width: 1000, height: 1400 }],
    plan: {
      entryStart: 0,
      entryEnd: 0,
      regions: [
        {
          pageIndex: 0,
          firstSystem: 2,
          lastSystem: 2,
          area: r(280, 380, 540, 240),
          entryStart: 0,
          entryEnd: 0,
        },
      ],
      width: 940,
      height: 940,
      stackHeight: 240,
      enlarged: false,
    },
    expected: {
      width: 940,
      height: 940,
      stackTop: 350,
      contents: [
        {
          kind: 'region',
          regionIndex: 0,
          pageIndex: 0,
          source: r(80, 380, 920, 240),
          dest: r(0, 350, 920, 240),
        },
        {
          kind: 'filler-top',
          regionIndex: 0,
          pageIndex: 0,
          source: r(80, 30, 920, 350),
          dest: r(0, 0, 920, 350),
        },
        {
          kind: 'filler-bottom',
          regionIndex: 0,
          pageIndex: 0,
          source: r(80, 620, 920, 350),
          dest: r(0, 590, 920, 350),
        },
      ],
      overlays: [r(0, 50, 940, 240)],
    },
  },
];
