/**
 * Fixtures: core/slides findEntryForSystem
 * Requirements: SLD-012, FIL-014
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */

export const findEntryForSystemCases: ReadonlyArray<{ id: string; req: string; name: string; entries: number[]; systemIndex: number; expected: number }> = [
  {
    id: 'EL1',
    req: 'SLD-012, FIL-014',
    name: 'system present: first occurrence',
    entries: [1, 2, 1, 2, 3, 4],
    systemIndex: 2,
    expected: 1,
  },
  {
    id: 'EL2',
    req: 'SLD-012, FIL-014',
    name: 'system 1 in a repeat',
    entries: [1, 2, 1, 2, 3, 4],
    systemIndex: 1,
    expected: 0,
  },
  {
    id: 'EL3',
    req: 'SLD-012, FIL-014',
    name: 'system beyond all entries: last entry',
    entries: [1, 2, 1, 2, 3, 4],
    systemIndex: 5,
    expected: 5,
  },
  {
    id: 'EL4',
    req: 'SLD-012, FIL-014',
    name: 'system not played: next greater system',
    entries: [1, 2, 5, 6],
    systemIndex: 3,
    expected: 2,
  },
  {
    id: 'EL5',
    req: 'SLD-012, FIL-014',
    name: 'empty order',
    entries: [],
    systemIndex: 1,
    expected: -1,
  },
  {
    id: 'EL6',
    req: 'SLD-012, FIL-014',
    name: 'not played, next greater has several occurrences: first of them',
    entries: [4, 1, 4, 2],
    systemIndex: 3,
    expected: 0,
  },
  {
    id: 'EL7',
    req: 'SLD-012, FIL-014',
    name: 'system 0 (before all): smallest greater',
    entries: [3, 2, 5],
    systemIndex: 0,
    expected: 1,
  },
  {
    id: 'EL8',
    req: 'SLD-012, FIL-014',
    name: 'D.S. order, system 7 not played',
    entries: [1, 2, 3, 4, 5, 6, 2, 3, 8],
    systemIndex: 7,
    expected: 8,
  },
];
