/**
 * Fixtures: core/scheduler
 * Requirements: NFR-003, DET-017
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { SchedulerContext, TaskInfo } from '../scheduler';

export const pickNextCases: ReadonlyArray<{ id: string; req: string; name: string; queue: TaskInfo[]; ctx: SchedulerContext; expected: TaskInfo | null }> = [
  {
    id: 'PN01',
    req: 'NFR-003',
    name: 'empty queue',
    queue: [],
    ctx: { userActive: false, hidden: false, batterySaver: null, strokeInProgress: false },
    expected: null,
  },
  {
    id: 'PN02',
    req: 'NFR-003',
    name: 'priority beats submission order',
    queue: [
      { id: 'd1', cls: 'detection', seq: 1 },
      { id: 'p1', cls: 'prefetch', seq: 2 },
      { id: 'v1', cls: 'visible', seq: 3 },
    ],
    ctx: { userActive: false, hidden: false, batterySaver: null, strokeInProgress: false },
    expected: { id: 'v1', cls: 'visible', seq: 3 },
  },
  {
    id: 'PN03',
    req: 'NFR-003',
    name: 'same class: smaller seq first',
    queue: [{ id: 'p5', cls: 'prefetch', seq: 5 }, { id: 'p2', cls: 'prefetch', seq: 2 }],
    ctx: { userActive: false, hidden: false, batterySaver: null, strokeInProgress: false },
    expected: { id: 'p2', cls: 'prefetch', seq: 2 },
  },
  {
    id: 'PN04',
    req: 'NFR-003',
    name: 'detection waits while the user is active',
    queue: [{ id: 'd1', cls: 'detection', seq: 1 }, { id: 's1', cls: 'save', seq: 2 }],
    ctx: { userActive: true, hidden: false, batterySaver: null, strokeInProgress: false },
    expected: { id: 's1', cls: 'save', seq: 2 },
  },
  {
    id: 'PN05',
    req: 'NFR-003',
    name: 'hidden blocks detection and prefetch',
    queue: [{ id: 'p1', cls: 'prefetch', seq: 1 }, { id: 'd1', cls: 'detection', seq: 2 }],
    ctx: { userActive: false, hidden: true, batterySaver: null, strokeInProgress: false },
    expected: null,
  },
  {
    id: 'PN06',
    req: 'NFR-003',
    name: 'battery saver on blocks detection',
    queue: [{ id: 'd1', cls: 'detection', seq: 1 }],
    ctx: { userActive: false, hidden: false, batterySaver: true, strokeInProgress: false },
    expected: null,
  },
  {
    id: 'PN07',
    req: 'NFR-003',
    name: 'battery saver off does not block detection',
    queue: [{ id: 'd1', cls: 'detection', seq: 1 }],
    ctx: { userActive: false, hidden: false, batterySaver: false, strokeInProgress: false },
    expected: { id: 'd1', cls: 'detection', seq: 1 },
  },
  {
    id: 'PN08',
    req: 'NFR-003',
    name: 'battery saver unknown does not block detection',
    queue: [{ id: 'd1', cls: 'detection', seq: 1 }],
    ctx: { userActive: false, hidden: false, batterySaver: null, strokeInProgress: false },
    expected: { id: 'd1', cls: 'detection', seq: 1 },
  },
  {
    id: 'PN09',
    req: 'NFR-003',
    name: 'a stroke in progress blocks saving',
    queue: [{ id: 's1', cls: 'save', seq: 1 }, { id: 'd1', cls: 'detection', seq: 2 }],
    ctx: { userActive: false, hidden: false, batterySaver: null, strokeInProgress: true },
    expected: { id: 'd1', cls: 'detection', seq: 2 },
  },
  {
    id: 'PN10',
    req: 'NFR-003',
    name: 'input beats visible',
    queue: [{ id: 'v1', cls: 'visible', seq: 1 }, { id: 'i1', cls: 'input', seq: 2 }],
    ctx: { userActive: true, hidden: true, batterySaver: null, strokeInProgress: false },
    expected: { id: 'i1', cls: 'input', seq: 2 },
  },
  {
    id: 'PN11',
    req: 'NFR-003',
    name: 'visible stays eligible when hidden',
    queue: [{ id: 'v1', cls: 'visible', seq: 1 }],
    ctx: { userActive: false, hidden: true, batterySaver: null, strokeInProgress: false },
    expected: { id: 'v1', cls: 'visible', seq: 1 },
  },
  {
    id: 'PN12',
    req: 'NFR-003',
    name: 'save beats detection',
    queue: [{ id: 'd1', cls: 'detection', seq: 1 }, { id: 's1', cls: 'save', seq: 2 }],
    ctx: { userActive: false, hidden: false, batterySaver: null, strokeInProgress: false },
    expected: { id: 's1', cls: 'save', seq: 2 },
  },
];

export const tasksToCancelCases: ReadonlyArray<{ id: string; req: string; name: string; running: TaskInfo[]; incoming: TaskInfo; expected: string[] }> = [
  {
    id: 'TC01',
    req: 'NFR-003',
    name: 'visible cancels prefetch and detection',
    running: [
      { id: 'p1', cls: 'prefetch', seq: 1 },
      { id: 'd1', cls: 'detection', seq: 2 },
      { id: 's1', cls: 'save', seq: 3 },
      { id: 'v1', cls: 'visible', seq: 4 },
    ],
    incoming: { id: 'v2', cls: 'visible', seq: 5 },
    expected: ['p1', 'd1'],
  },
  {
    id: 'TC02',
    req: 'NFR-003',
    name: 'input cancels prefetch and detection',
    running: [{ id: 'p1', cls: 'prefetch', seq: 1 }, { id: 'd1', cls: 'detection', seq: 2 }],
    incoming: { id: 'i1', cls: 'input', seq: 3 },
    expected: ['p1', 'd1'],
  },
  {
    id: 'TC03',
    req: 'NFR-003',
    name: 'prefetch cancels nothing',
    running: [{ id: 'd1', cls: 'detection', seq: 1 }],
    incoming: { id: 'p1', cls: 'prefetch', seq: 2 },
    expected: [],
  },
  {
    id: 'TC04',
    req: 'NFR-003',
    name: 'save cancels nothing',
    running: [{ id: 'p1', cls: 'prefetch', seq: 1 }],
    incoming: { id: 's1', cls: 'save', seq: 2 },
    expected: [],
  },
  {
    id: 'TC05',
    req: 'NFR-003',
    name: 'nothing running',
    running: [],
    incoming: { id: 'v1', cls: 'visible', seq: 1 },
    expected: [],
  },
];
