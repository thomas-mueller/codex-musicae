import { describe, expect, it } from 'vitest';

import { caseTitle, expectCloseDeep } from './expect-close-deep';

describe('expectCloseDeep', () => {
  it('TST-001 accepts floating-point noise in nested data', () => {
    expectCloseDeep({ a: [0.1 + 0.2, { b: 1 }], c: 'x' }, { a: [0.3, { b: 1 }], c: 'x' });
  });

  it('TST-001 rejects different numbers, keys and lengths', () => {
    expect(() => expectCloseDeep({ a: 1 }, { a: 1.001 })).toThrow();
    expect(() => expectCloseDeep({ a: 1 }, { b: 1 })).toThrow();
    expect(() => expectCloseDeep([1], [1, 2])).toThrow();
  });

  it('TST-001 builds titles with the id as name fallback', () => {
    expect(caseTitle({ id: 'X1', req: 'A-1', name: 'n' }, 'F-1')).toBe('A-1 X1: n');
    expect(caseTitle({ id: 'X2' }, 'F-1')).toBe('F-1 X2: X2');
  });
});
