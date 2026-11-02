/**
 * Fixtures: core/annotation
 * Requirements: ANN-005, ANN-006, ANN-009..ANN-012, SAV-007
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference-3.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { PageBox, Point, Rect } from '../geometry';
import type { InkStroke, InkTransform, StrokeOwner, UndoAction, UndoState } from '../annotation';
import type { SlideComposition } from '../composition';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });
const p = (x: number, y: number): Point => ({ x, y });
void r; void p;

export const simplifyPathCases: ReadonlyArray<{ id: string; req: string; name: string; points: Point[]; epsilon: number; expected: Point[] }> = [
  { id: 'SP1', req: 'ANN-011', name: 'empty', points: [], epsilon: 0.5, expected: [] },
  {
    id: 'SP2',
    req: 'ANN-011',
    name: 'one point',
    points: [p(1, 2)],
    epsilon: 0.5,
    expected: [p(1, 2)],
  },
  {
    id: 'SP3',
    req: 'ANN-011',
    name: 'two points',
    points: [p(0, 0), p(5, 5)],
    epsilon: 0.5,
    expected: [p(0, 0), p(5, 5)],
  },
  {
    id: 'SP4',
    req: 'ANN-011',
    name: 'collinear points are dropped',
    points: [p(0, 0), p(1, 1), p(2, 2), p(3, 3)],
    epsilon: 0.1,
    expected: [p(0, 0), p(3, 3)],
  },
  {
    id: 'SP5',
    req: 'ANN-011',
    name: 'small bump dropped, big peak and the corner kept',
    points: [p(0, 0), p(5, 0.05), p(10, 0), p(15, 10), p(20, 0)],
    epsilon: 0.5,
    expected: [p(0, 0), p(10, 0), p(15, 10), p(20, 0)],
  },
  {
    id: 'SP6',
    req: 'ANN-011',
    name: 'epsilon 0 keeps any deviation',
    points: [p(0, 0), p(1, 0.001), p(2, 0)],
    epsilon: 0,
    expected: [p(0, 0), p(1, 0.001), p(2, 0)],
  },
  {
    id: 'SP7',
    req: 'ANN-011',
    name: 'identical points keep first and last',
    points: [p(0, 0), p(0, 0), p(0, 0)],
    epsilon: 0.1,
    expected: [p(0, 0), p(0, 0)],
  },
  {
    id: 'SP8',
    req: 'ANN-011',
    name: 'closed square keeps all corners',
    points: [p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 0)],
    epsilon: 0.5,
    expected: [p(0, 0), p(10, 0), p(10, 10), p(0, 10), p(0, 0)],
  },
  {
    id: 'SP9',
    req: 'ANN-011',
    name: 'deviation exactly equal to epsilon is dropped (strictly greater needed)',
    points: [p(0, 0), p(5, 1), p(10, 0)],
    epsilon: 1,
    expected: [p(0, 0), p(10, 0)],
  },
];

export const distanceToPolylineCases: ReadonlyArray<{ id: string; req: string; name: string; point: Point; points: Point[]; expected: number }> = [
  {
    id: 'DP1',
    req: 'ANN-005',
    name: 'empty polyline',
    point: p(1, 1),
    points: [],
    expected: Infinity,
  },
  {
    id: 'DP2',
    req: 'ANN-005',
    name: 'single point',
    point: p(3, 4),
    points: [p(0, 0)],
    expected: 5,
  },
  {
    id: 'DP3',
    req: 'ANN-005',
    name: 'beside a segment',
    point: p(5, 3),
    points: [p(0, 0), p(10, 0)],
    expected: 3,
  },
  {
    id: 'DP4',
    req: 'ANN-005',
    name: 'beyond the segment end uses the end point',
    point: p(-4, 3),
    points: [p(0, 0), p(10, 0)],
    expected: 5,
  },
  {
    id: 'DP5',
    req: 'ANN-005',
    name: 'second segment of an L',
    point: p(12, 5),
    points: [p(0, 0), p(10, 0), p(10, 10)],
    expected: 2,
  },
  {
    id: 'DP6',
    req: 'ANN-005',
    name: 'on the line',
    point: p(5, 0),
    points: [p(0, 0), p(10, 0)],
    expected: 0,
  },
];

export const strokeHitCases: ReadonlyArray<{ id: string; req: string; name: string; stroke: InkStroke; point: Point; radiusPt: number; expected: boolean }> = [
  {
    id: 'SH1',
    req: 'ANN-005',
    name: 'distance 5 > radius 3 + half width 1',
    stroke: {
      id: 'a',
      pageIndex: 0,
      points: [p(0, 0), p(10, 0)],
      color: '#000000',
      widthPt: 2,
      opacity: 1,
      multiply: false,
    },
    point: p(5, 5),
    radiusPt: 3,
    expected: false,
  },
  {
    id: 'SH2',
    req: 'ANN-005',
    name: 'distance 5 equals radius 4 + half width 1 (inclusive)',
    stroke: {
      id: 'a',
      pageIndex: 0,
      points: [p(0, 0), p(10, 0)],
      color: '#000000',
      widthPt: 2,
      opacity: 1,
      multiply: false,
    },
    point: p(5, 5),
    radiusPt: 4,
    expected: true,
  },
  {
    id: 'SH3',
    req: 'ANN-005',
    name: 'point on the stroke, radius 0',
    stroke: {
      id: 'a',
      pageIndex: 0,
      points: [p(0, 0), p(10, 0)],
      color: '#000000',
      widthPt: 0,
      opacity: 1,
      multiply: false,
    },
    point: p(5, 0),
    radiusPt: 0,
    expected: true,
  },
  {
    id: 'SH4',
    req: 'ANN-005',
    name: 'empty stroke is never hit',
    stroke: { id: 'a', pageIndex: 0, points: [], color: '#000000', widthPt: 2, opacity: 1, multiply: false },
    point: p(0, 0),
    radiusPt: 100,
    expected: false,
  },
];

/** Compositions used below: the `expected` of composition.cases.ts entries CP01..CP06 (id = 'CPnn'), and the hand-made SYN. */
export const synComposition: SlideComposition = {
  width: 100,
  height: 200,
  stackTop: 0,
  overlays: [],
  contents: [
    {
      kind: 'region',
      regionIndex: 0,
      pageIndex: 0,
      source: r(0, 0, 100, 100),
      dest: r(0, 0, 100, 100),
    },
    {
      kind: 'filler-bottom',
      regionIndex: 0,
      pageIndex: 1,
      source: r(10, 10, 100, 100),
      dest: r(0, 50, 100, 100),
    },
    {
      kind: 'filler-top',
      regionIndex: 0,
      pageIndex: 0,
      source: r(0, 0, 100, 100),
      dest: r(0, 120, 100, 80),
    },
  ],
};

/** `composition` names a composeSlideCases entry (id) whose `expected` is the input; 'SYN' means synComposition. */
export const inkTransformsCases: ReadonlyArray<{ id: string; req: string; composition: string; expected: InkTransform[] }> = [
  {
    id: 'IT-CP01',
    req: 'ANN-012',
    composition: 'CP01',
    expected: [{ pageIndex: 0, dx: -30, dy: -36.666666666666686 }],
  },
  {
    id: 'IT-CP02',
    req: 'ANN-012',
    composition: 'CP02',
    expected: [
      { pageIndex: 0, dx: -30, dy: -606.6666666666667 },
      { pageIndex: 1, dx: -30, dy: 233.33333333333331 },
    ],
  },
  {
    id: 'IT-CP03',
    req: 'ANN-012',
    composition: 'CP03',
    expected: [{ pageIndex: 0, dx: 100, dy: -80 }],
  },
  {
    id: 'IT-CP04',
    req: 'ANN-012',
    composition: 'CP04',
    expected: [{ pageIndex: 0, dx: -30, dy: 210 }],
  },
  {
    id: 'IT-CP05',
    req: 'ANN-012',
    composition: 'CP05',
    expected: [{ pageIndex: 0, dx: -30, dy: -400 }],
  },
  {
    id: 'IT-CP06',
    req: 'ANN-012',
    composition: 'CP06',
    expected: [{ pageIndex: 0, dx: -80, dy: -30 }],
  },
];

export const startOwnerCases: ReadonlyArray<{ id: string; req: string; name: string; composition: string; point: Point; expected: StrokeOwner | null }> = [
  {
    id: 'SO1',
    req: 'ANN-009, ANN-010',
    name: 'inside region 0',
    composition: 'CP02',
    point: p(100, 100),
    expected: { contentIndex: 0, pageIndex: 0, dx: -30, dy: -606.6666666666667 },
  },
  {
    id: 'SO2',
    req: 'ANN-009, ANN-010',
    name: 'inside the top filler',
    composition: 'CP02',
    point: p(100, 20),
    expected: { contentIndex: 2, pageIndex: 0, dx: -30, dy: -606.6666666666667 },
  },
  {
    id: 'SO3',
    req: 'ANN-009, ANN-010',
    name: 'inside region 1 (page 1)',
    composition: 'CP02',
    point: p(100, 320),
    expected: { contentIndex: 1, pageIndex: 1, dx: -30, dy: 233.33333333333331 },
  },
  {
    id: 'SO4',
    req: 'ANN-009, ANN-010',
    name: 'inside the bottom filler (page 1)',
    composition: 'CP02',
    point: p(100, 600),
    expected: { contentIndex: 3, pageIndex: 1, dx: -30, dy: 233.33333333333326 },
  },
  {
    id: 'SO5',
    req: 'ANN-009, ANN-010',
    name: 'right of the slide content',
    composition: 'CP02',
    point: p(950, 100),
    expected: null,
  },
  {
    id: 'SO6',
    req: 'ANN-009, ANN-010',
    name: 'above the slide',
    composition: 'CP02',
    point: p(100, -1),
    expected: null,
  },
  {
    id: 'SO7',
    req: 'ANN-009, ANN-010',
    name: 'grey side of an enlarged slide',
    composition: 'CP03',
    point: p(50, 100),
    expected: null,
  },
  {
    id: 'SO8',
    req: 'ANN-009, ANN-010',
    name: 'dest edge is inclusive',
    composition: 'CP03',
    point: p(100, 0),
    expected: { contentIndex: 0, pageIndex: 0, dx: 100, dy: -80 },
  },
  {
    id: 'SO9',
    req: 'ANN-009, ANN-010',
    name: 'dest right edge is exclusive',
    composition: 'CP03',
    point: p(1100, 100),
    expected: null,
  },
  {
    id: 'SO10',
    req: 'ANN-009, ANN-010',
    name: 'right of the clipped region',
    composition: 'CP06',
    point: p(930, 100),
    expected: null,
  },
];

export const placementsAtCases: ReadonlyArray<{ id: string; req: string; name: string; composition: string; point: Point; expected: InkTransform[] }> = [
  {
    id: 'PA1',
    req: 'ANN-012',
    name: 'CP02 100,100',
    composition: 'CP02',
    point: p(100, 100),
    expected: [{ pageIndex: 0, dx: -30, dy: -606.6666666666667 }],
  },
  {
    id: 'PA2',
    req: 'ANN-012',
    name: 'CP02 100,20',
    composition: 'CP02',
    point: p(100, 20),
    expected: [{ pageIndex: 0, dx: -30, dy: -606.6666666666667 }],
  },
  {
    id: 'PA3',
    req: 'ANN-012',
    name: 'CP02 950,100',
    composition: 'CP02',
    point: p(950, 100),
    expected: [],
  },
  {
    id: 'PA4',
    req: 'ANN-012',
    name: 'overlapping contents of two pages give two placements',
    composition: 'SYN',
    point: p(50, 75),
    expected: [{ pageIndex: 0, dx: 0, dy: 0 }, { pageIndex: 1, dx: -10, dy: 40 }],
  },
  {
    id: 'PA5',
    req: 'ANN-012',
    name: 'same page, same translation twice gives one placement',
    composition: 'SYN',
    point: p(50, 125),
    expected: [{ pageIndex: 1, dx: -10, dy: 40 }, { pageIndex: 0, dx: 0, dy: 120 }],
  },
];

/** slidePointToUser(owner, box, point) = expectedUser, and userPointToSlide(owner, box, expectedUser) = expectedBack (the original point). */
export const pointMappingCases: ReadonlyArray<{
  id: string; req: string; name: string; owner: InkTransform; box: PageBox; point: Point; expectedUser: Point; expectedBack: Point;
}> = [
  {
    id: 'SM1',
    req: 'SAV-007, ANN-009',
    name: 'rotate 0',
    owner: { pageIndex: 0, dx: -30, dy: -606.667 },
    box: { view: [0, 0, 600, 800], rotate: 0 },
    point: p(100, 100),
    expectedUser: p(130, 93.33299999999997),
    expectedBack: p(100, 100),
  },
  {
    id: 'SM2',
    req: 'SAV-007, ANN-009',
    name: 'rotate 90',
    owner: { pageIndex: 0, dx: 0, dy: 0 },
    box: { view: [0, 0, 600, 800], rotate: 90 },
    point: p(200, 100),
    expectedUser: p(100, 200),
    expectedBack: p(200, 100),
  },
  {
    id: 'SM3',
    req: 'SAV-007, ANN-009',
    name: 'point outside the page keeps the owner translation',
    owner: { pageIndex: 0, dx: 0, dy: 0 },
    box: { view: [0, 0, 600, 800], rotate: 0 },
    point: p(-50, 900),
    expectedUser: p(-50, -100),
    expectedBack: p(-50, 900),
  },
];

export const pushActionCases: ReadonlyArray<{ id: string; req: string; name: string; state: UndoState; action: UndoAction; depth: number; expected: UndoState }> = [
  {
    id: 'PU1',
    req: 'ANN-006',
    name: 'first action',
    state: { undo: [], redo: [] },
    action: {
      kind: 'add',
      stroke: {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    depth: 3,
    expected: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'a',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
      redo: [],
    },
  },
  {
    id: 'PU2',
    req: 'ANN-006',
    name: 'depth 3 drops the oldest',
    state: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'a',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
        {
          kind: 'add',
          stroke: {
            id: 'b',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
        {
          kind: 'add',
          stroke: {
            id: 'c',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
      redo: [],
    },
    action: {
      kind: 'add',
      stroke: {
        id: 'd',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    depth: 3,
    expected: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'b',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
        {
          kind: 'add',
          stroke: {
            id: 'c',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
        {
          kind: 'add',
          stroke: {
            id: 'd',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
      redo: [],
    },
  },
  {
    id: 'PU3',
    req: 'ANN-006',
    name: 'a new action clears redo',
    state: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'a',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
      redo: [
        {
          kind: 'add',
          stroke: {
            id: 'b',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
    },
    action: {
      kind: 'add',
      stroke: {
        id: 'c',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    depth: 5,
    expected: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'a',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
        {
          kind: 'add',
          stroke: {
            id: 'c',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
      redo: [],
    },
  },
];

export const undoRedoStepCases: ReadonlyArray<{
  id: string; req: string; name: string; kind: 'undo' | 'redo'; state: UndoState; expected: { state: UndoState; action: UndoAction | null };
}> = [
  {
    id: 'US1',
    req: 'ANN-006',
    name: 'undo pops the newest',
    kind: 'undo',
    state: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'a',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
        {
          kind: 'erase',
          strokes: [
            {
              id: 'b',
              pageIndex: 0,
              points: [p(0, 0), p(10, 10)],
              color: '#D32F2F',
              widthPt: 2.5,
              opacity: 1,
              multiply: false,
            },
            {
              id: 'c',
              pageIndex: 0,
              points: [p(0, 0), p(10, 10)],
              color: '#D32F2F',
              widthPt: 2.5,
              opacity: 1,
              multiply: false,
            },
          ],
        },
      ],
      redo: [],
    },
    expected: {
      state: {
        undo: [
          {
            kind: 'add',
            stroke: {
              id: 'a',
              pageIndex: 0,
              points: [p(0, 0), p(10, 10)],
              color: '#D32F2F',
              widthPt: 2.5,
              opacity: 1,
              multiply: false,
            },
          },
        ],
        redo: [
          {
            kind: 'erase',
            strokes: [
              {
                id: 'b',
                pageIndex: 0,
                points: [p(0, 0), p(10, 10)],
                color: '#D32F2F',
                widthPt: 2.5,
                opacity: 1,
                multiply: false,
              },
              {
                id: 'c',
                pageIndex: 0,
                points: [p(0, 0), p(10, 10)],
                color: '#D32F2F',
                widthPt: 2.5,
                opacity: 1,
                multiply: false,
              },
            ],
          },
        ],
      },
      action: {
        kind: 'erase',
        strokes: [
          {
            id: 'b',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
          {
            id: 'c',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        ],
      },
    },
  },
  {
    id: 'US2',
    req: 'ANN-006',
    name: 'undo on empty',
    kind: 'undo',
    state: { undo: [], redo: [] },
    expected: { state: { undo: [], redo: [] }, action: null },
  },
  {
    id: 'US3',
    req: 'ANN-006',
    name: 'redo moves back',
    kind: 'redo',
    state: {
      undo: [
        {
          kind: 'add',
          stroke: {
            id: 'a',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        },
      ],
      redo: [
        {
          kind: 'erase',
          strokes: [
            {
              id: 'b',
              pageIndex: 0,
              points: [p(0, 0), p(10, 10)],
              color: '#D32F2F',
              widthPt: 2.5,
              opacity: 1,
              multiply: false,
            },
            {
              id: 'c',
              pageIndex: 0,
              points: [p(0, 0), p(10, 10)],
              color: '#D32F2F',
              widthPt: 2.5,
              opacity: 1,
              multiply: false,
            },
          ],
        },
      ],
    },
    expected: {
      state: {
        undo: [
          {
            kind: 'add',
            stroke: {
              id: 'a',
              pageIndex: 0,
              points: [p(0, 0), p(10, 10)],
              color: '#D32F2F',
              widthPt: 2.5,
              opacity: 1,
              multiply: false,
            },
          },
          {
            kind: 'erase',
            strokes: [
              {
                id: 'b',
                pageIndex: 0,
                points: [p(0, 0), p(10, 10)],
                color: '#D32F2F',
                widthPt: 2.5,
                opacity: 1,
                multiply: false,
              },
              {
                id: 'c',
                pageIndex: 0,
                points: [p(0, 0), p(10, 10)],
                color: '#D32F2F',
                widthPt: 2.5,
                opacity: 1,
                multiply: false,
              },
            ],
          },
        ],
        redo: [],
      },
      action: {
        kind: 'erase',
        strokes: [
          {
            id: 'b',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
          {
            id: 'c',
            pageIndex: 0,
            points: [p(0, 0), p(10, 10)],
            color: '#D32F2F',
            widthPt: 2.5,
            opacity: 1,
            multiply: false,
          },
        ],
      },
    },
  },
  {
    id: 'US4',
    req: 'ANN-006',
    name: 'redo on empty',
    kind: 'redo',
    state: { undo: [], redo: [] },
    expected: { state: { undo: [], redo: [] }, action: null },
  },
];

export const applyActionCases: ReadonlyArray<{
  id: string; req: string; name: string; strokes: InkStroke[]; action: UndoAction; direction: 'undo' | 'redo'; expected: InkStroke[];
}> = [
  {
    id: 'AA1',
    req: 'ANN-006',
    name: 'redo add appends',
    strokes: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
    action: {
      kind: 'add',
      stroke: {
        id: 'b',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    direction: 'redo',
    expected: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
      {
        id: 'b',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
  },
  {
    id: 'AA2',
    req: 'ANN-006',
    name: 'undo add removes by id',
    strokes: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
      {
        id: 'b',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
    action: {
      kind: 'add',
      stroke: {
        id: 'b',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    direction: 'undo',
    expected: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
  },
  {
    id: 'AA3',
    req: 'ANN-006',
    name: 'redo erase removes the listed ids',
    strokes: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
      {
        id: 'b',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
      {
        id: 'c',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
    action: {
      kind: 'erase',
      strokes: [
        {
          id: 'b',
          pageIndex: 0,
          points: [p(0, 0), p(10, 10)],
          color: '#D32F2F',
          widthPt: 2.5,
          opacity: 1,
          multiply: false,
        },
        {
          id: 'c',
          pageIndex: 0,
          points: [p(0, 0), p(10, 10)],
          color: '#D32F2F',
          widthPt: 2.5,
          opacity: 1,
          multiply: false,
        },
      ],
    },
    direction: 'redo',
    expected: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
  },
  {
    id: 'AA4',
    req: 'ANN-006',
    name: 'undo erase appends in listed order',
    strokes: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
    action: {
      kind: 'erase',
      strokes: [
        {
          id: 'c',
          pageIndex: 0,
          points: [p(0, 0), p(10, 10)],
          color: '#D32F2F',
          widthPt: 2.5,
          opacity: 1,
          multiply: false,
        },
        {
          id: 'b',
          pageIndex: 0,
          points: [p(0, 0), p(10, 10)],
          color: '#D32F2F',
          widthPt: 2.5,
          opacity: 1,
          multiply: false,
        },
      ],
    },
    direction: 'undo',
    expected: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
      {
        id: 'c',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
      {
        id: 'b',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
  },
  {
    id: 'AA5',
    req: 'ANN-006',
    name: 'removing an absent id changes nothing',
    strokes: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
    action: {
      kind: 'add',
      stroke: {
        id: 'z',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    direction: 'undo',
    expected: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
  },
  {
    id: 'AA6',
    req: 'ANN-006',
    name: 'adding an existing id changes nothing',
    strokes: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
    action: {
      kind: 'add',
      stroke: {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    },
    direction: 'redo',
    expected: [
      {
        id: 'a',
        pageIndex: 0,
        points: [p(0, 0), p(10, 10)],
        color: '#D32F2F',
        widthPt: 2.5,
        opacity: 1,
        multiply: false,
      },
    ],
  },
];
