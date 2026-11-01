/**
 * Fixtures: core/detection-queue
 * Requirements: DET-016, DET-019, DET-021
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { PageState } from '../detection-queue';

export const usablePrefixCases: ReadonlyArray<{ id: string; req: string; states: PageState[]; expected: number }> = [
  { id: 'Q01', req: 'DET-019', states: [], expected: 0 },
  { id: 'Q02', req: 'DET-019', states: ['done', 'done', 'pending'], expected: 2 },
  { id: 'Q03', req: 'DET-019', states: ['done', 'failed', 'done'], expected: 3 },
  { id: 'Q04', req: 'DET-019', states: ['pending', 'done'], expected: 0 },
  { id: 'Q05', req: 'DET-019', states: ['done', 'running', 'done'], expected: 1 },
  { id: 'Q06', req: 'DET-019', states: ['done', 'done', 'done'], expected: 3 },
  { id: 'Q07', req: 'DET-019', states: ['failed', 'failed'], expected: 2 },
];

export const isCompleteCases: ReadonlyArray<{ id: string; req: string; states: PageState[]; expected: boolean }> = [
  { id: 'QC1', req: 'DET-016', states: [], expected: true },
  { id: 'QC2', req: 'DET-016', states: ['done', 'failed'], expected: true },
  { id: 'QC3', req: 'DET-016', states: ['done', 'pending'], expected: false },
  { id: 'QC4', req: 'DET-016', states: ['done', 'running'], expected: false },
];

export const nextPageToProcessCases: ReadonlyArray<{ id: string; req: string; states: PageState[]; priorityPage: number | null; expected: number | null }> = [
  {
    id: 'QN1',
    req: 'DET-021',
    states: ['done', 'pending', 'pending'],
    priorityPage: null,
    expected: 1,
  },
  {
    id: 'QN2',
    req: 'DET-021',
    states: ['done', 'pending', 'pending'],
    priorityPage: 2,
    expected: 2,
  },
  {
    id: 'QN3',
    req: 'DET-021',
    states: ['done', 'running', 'pending'],
    priorityPage: 1,
    expected: 2,
  },
  { id: 'QN4', req: 'DET-021', states: ['done', 'done'], priorityPage: null, expected: null },
  {
    id: 'QN5',
    req: 'DET-021',
    states: ['done', 'pending', 'pending'],
    priorityPage: 9,
    expected: 1,
  },
  { id: 'QN6', req: 'DET-021', states: ['done', 'pending', 'done'], priorityPage: 2, expected: 1 },
  { id: 'QN7', req: 'DET-021', states: ['pending', 'pending'], priorityPage: -1, expected: 0 },
  { id: 'QN8', req: 'DET-021', states: ['pending', 'pending'], priorityPage: 0, expected: 0 },
  { id: 'QN9', req: 'DET-021', states: ['running', 'pending'], priorityPage: null, expected: 1 },
];

export const isProvisionalCases: ReadonlyArray<{ id: string; req: string; states: PageState[]; pageIndex: number; expected: boolean }> = [
  { id: 'QP1', req: 'DET-021', states: ['done', 'pending', 'done'], pageIndex: 2, expected: true },
  { id: 'QP2', req: 'DET-021', states: ['done', 'pending', 'done'], pageIndex: 0, expected: false },
  { id: 'QP3', req: 'DET-021', states: ['pending', 'done'], pageIndex: 1, expected: true },
  { id: 'QP4', req: 'DET-021', states: ['done', 'done'], pageIndex: 1, expected: false },
  { id: 'QP5', req: 'DET-021', states: ['done', 'failed', 'done'], pageIndex: 2, expected: false },
  { id: 'QP6', req: 'DET-021', states: ['pending', 'pending'], pageIndex: 0, expected: false },
];
