import { describe, expect, it } from 'vitest';

import { cacheBudgetFor } from './cache-budget';

const table = { 1: 10, 2: 20, 4: 40, 8: 80 };
const fallback = 99;

describe('cacheBudgetFor', () => {
  it('NFR-004 uses the default when the memory is unknown', () => {
    expect(cacheBudgetFor(undefined, table, fallback)).toBe(fallback);
  });

  it('NFR-004 picks the exact bucket', () => {
    expect(cacheBudgetFor(4, table, fallback)).toBe(40);
  });

  it('NFR-004 picks the nearest lower bucket', () => {
    expect(cacheBudgetFor(6, table, fallback)).toBe(40);
    expect(cacheBudgetFor(3, table, fallback)).toBe(20);
  });

  it('NFR-004 caps at the largest bucket', () => {
    expect(cacheBudgetFor(32, table, fallback)).toBe(80);
  });

  it('NFR-004 uses the smallest bucket below it', () => {
    expect(cacheBudgetFor(0.5, table, fallback)).toBe(10);
  });

  it('NFR-004 uses the default for an empty table', () => {
    expect(cacheBudgetFor(4, {}, fallback)).toBe(fallback);
  });
});
