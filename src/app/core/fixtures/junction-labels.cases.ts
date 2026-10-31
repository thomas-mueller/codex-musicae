/**
 * Fixtures: core/junctions junctionLabel
 * Requirements: ORG-018, ORG-021
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Bar } from '../model';
import type { JunctionLabel } from '../junctions';

/** Bars of the two-page document of junction case J1 (computeBars output). */
export const labelBars: Bar[] = [
  { junction: 0, pageIndex: 0, y: 0, height: 100 },
  { junction: 1, pageIndex: 0, y: 300, height: 100 },
  { junction: 2, pageIndex: 0, y: 580, height: 820 },
  { junction: 2, pageIndex: 1, y: 0, height: 80 },
  { junction: 3, pageIndex: 1, y: 300, height: 1100 },
];

export const junctionLabelCases: ReadonlyArray<{ id: string; req: string; junction: number; expected: JunctionLabel | null }> = [
  { id: 'JL1', req: 'ORG-018, ORG-021', junction: 0, expected: { page: 1, ordinal: 1 } },
  { id: 'JL2', req: 'ORG-018, ORG-021', junction: 1, expected: { page: 1, ordinal: 2 } },
  { id: 'JL3', req: 'ORG-018, ORG-021', junction: 2, expected: { page: 1, ordinal: 3 } },
  { id: 'JL4', req: 'ORG-018, ORG-021', junction: 3, expected: { page: 2, ordinal: 2 } },
  { id: 'JL5', req: 'ORG-018, ORG-021', junction: 9, expected: null },
  { id: 'JL6', req: 'ORG-018, ORG-021', junction: -1, expected: null },
];
