/**
 * Fixtures: core/aspect-ratio
 * Requirements: SLD-013, SLD-014
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */

export const aspectLimits = { min: 0.5, max: 2.0, step: 0.1 } as const;
export const initialRatioConfig = { min: 0.5, max: 2.0, roundDecimals: 2 } as const;

export const stepAspectRatioCases: ReadonlyArray<{ id: string; req: string; current: number; direction: 'more' | 'less'; expected: number }> = [
  { id: 'AR01', req: 'SLD-013', current: 1.78, direction: 'more', expected: 1.7 },
  { id: 'AR02', req: 'SLD-013', current: 1.78, direction: 'less', expected: 1.8 },
  { id: 'AR03', req: 'SLD-013', current: 1.7, direction: 'more', expected: 1.6 },
  { id: 'AR04', req: 'SLD-013', current: 1.7, direction: 'less', expected: 1.8 },
  { id: 'AR05', req: 'SLD-013', current: 1, direction: 'more', expected: 0.9 },
  { id: 'AR06', req: 'SLD-013', current: 1, direction: 'less', expected: 1.1 },
  { id: 'AR07', req: 'SLD-013', current: 0.5, direction: 'more', expected: 0.5 },
  { id: 'AR08', req: 'SLD-013', current: 2, direction: 'less', expected: 2 },
  { id: 'AR09', req: 'SLD-013', current: 0.55, direction: 'more', expected: 0.5 },
  { id: 'AR10', req: 'SLD-013', current: 0.55, direction: 'less', expected: 0.6 },
  { id: 'AR11', req: 'SLD-013', current: 0.3, direction: 'less', expected: 0.5 },
  { id: 'AR12', req: 'SLD-013', current: 2.5, direction: 'more', expected: 2 },
  { id: 'AR13', req: 'SLD-013', current: 0.6, direction: 'more', expected: 0.5 },
  { id: 'AR14', req: 'SLD-013', current: 1.9, direction: 'less', expected: 2 },
  { id: 'AR15', req: 'SLD-013', current: 1.3, direction: 'more', expected: 1.2 },
  { id: 'AR16', req: 'SLD-013', current: 1.3, direction: 'less', expected: 1.4 },
  { id: 'AR17', req: 'SLD-013', current: 0.7, direction: 'less', expected: 0.8 },
  { id: 'AR18', req: 'SLD-013', current: 1.1, direction: 'more', expected: 1 },
];

export const initialAspectRatioCases: ReadonlyArray<{ id: string; req: string; width: number; height: number; expected: number }> = [
  { id: 'AI1', req: 'SLD-014', width: 1920, height: 1080, expected: 1.78 },
  { id: 'AI2', req: 'SLD-014', width: 360, height: 800, expected: 0.5 },
  { id: 'AI3', req: 'SLD-014', width: 800, height: 360, expected: 2 },
  { id: 'AI4', req: 'SLD-014', width: 1280, height: 800, expected: 1.6 },
  { id: 'AI5', req: 'SLD-014', width: 1024, height: 768, expected: 1.33 },
  { id: 'AI6', req: 'SLD-014', width: 768, height: 1024, expected: 0.75 },
];

export const orientationCases: ReadonlyArray<{ id: string; req: string; width: number; height: number; expected: 'portrait' | 'landscape' }> = [
  { id: 'AO1', req: 'SLD-014', width: 1000, height: 1000, expected: 'landscape' },
  { id: 'AO2', req: 'SLD-014', width: 999, height: 1000, expected: 'portrait' },
  { id: 'AO3', req: 'SLD-014', width: 1280, height: 800, expected: 'landscape' },
  { id: 'AO4', req: 'SLD-014', width: 360, height: 800, expected: 'portrait' },
];
