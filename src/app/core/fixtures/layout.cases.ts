/**
 * Fixtures: core/layout
 * Requirements: UIX-003
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */

export const sizeClassLimits = { compactMaxWidthPx: 600, compactMaxHeightPx: 480 } as const;

export const sizeClassCases: ReadonlyArray<{ id: string; req: string; width: number; height: number; expected: 'compact' | 'expanded' }> = [
  { id: 'SZ1', req: 'UIX-003', width: 320, height: 568, expected: 'compact' },
  { id: 'SZ2', req: 'UIX-003', width: 599, height: 800, expected: 'compact' },
  { id: 'SZ3', req: 'UIX-003', width: 600, height: 800, expected: 'expanded' },
  { id: 'SZ4', req: 'UIX-003', width: 800, height: 479, expected: 'compact' },
  { id: 'SZ5', req: 'UIX-003', width: 800, height: 480, expected: 'expanded' },
  { id: 'SZ6', req: 'UIX-003', width: 360, height: 800, expected: 'compact' },
  { id: 'SZ7', req: 'UIX-003', width: 800, height: 360, expected: 'compact' },
  { id: 'SZ8', req: 'UIX-003', width: 1280, height: 800, expected: 'expanded' },
  { id: 'SZ9', req: 'UIX-003', width: 2560, height: 1440, expected: 'expanded' },
  { id: 'SZ10', req: 'UIX-003', width: 600, height: 480, expected: 'expanded' },
];
