import { expect } from 'vitest';

/** Decimal places used when comparing floating-point numbers. */
const CLOSE_DIGITS = 9;

/** Recursive deep comparison: numbers with `toBeCloseTo`, everything else exactly. */
export function expectCloseDeep(actual: unknown, expected: unknown): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    expect(actual).toBeCloseTo(expected, CLOSE_DIGITS);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true);
    const a = actual as unknown[];
    expect(a.length).toBe(expected.length);
    expected.forEach((e, i) => expectCloseDeep(a[i], e));
  } else if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object').toBe(true);
    const a = actual as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(Object.keys(expected).sort());
    for (const [k, v] of Object.entries(expected)) {
      expectCloseDeep(a[k], v);
    }
  } else {
    expect(actual).toEqual(expected);
  }
}

/** Test title from a fixture case: `<req> <id>: <name>` (name falls back to the id; `fallbackReq` when the case has no req). */
export function caseTitle(c: { id: string; req?: string; name?: string }, fallbackReq: string): string {
  return `${c.req ?? fallbackReq} ${c.id}: ${c.name ?? c.id}`;
}
