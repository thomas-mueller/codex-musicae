import { describe, expect, it } from 'vitest';
import { FEATURES as NATIVE } from './features.native';
import { resolveFeatures } from './edition';

describe('resolveFeatures', () => {
  it('EDN-012 the paid edition enables every switch of the native file', () => {
    const resolved = resolveFeatures(NATIVE, 'paid');
    expect(Object.keys(resolved)).toEqual(Object.keys(NATIVE));
    expect(Object.values(resolved).every((value) => value === true)).toBe(true);
  });

  it('EDN-012 the free edition keeps the file as it is', () => {
    expect(resolveFeatures({ a: false, b: true }, 'free')).toEqual({ a: false, b: true });
  });

  it('EDN-012 the result is a frozen copy and the input stays unchanged', () => {
    const input = { a: false };
    const resolved = resolveFeatures(input, 'paid');
    expect(input).toEqual({ a: false });
    expect(resolved).not.toBe(input);
    expect(Object.isFrozen(resolved)).toBe(true);
  });
});
