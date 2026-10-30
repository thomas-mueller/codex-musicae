import { describe, expect, it } from 'vitest';

import { err, ok } from './result';

describe('Result', () => {
  it('ARC-005 ok(1) is { ok: true, value: 1 }', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });

  it('ARC-005 err("x") has no detail key', () => {
    const r = err('x');
    expect(r).toEqual({ ok: false, error: 'x' });
    expect('detail' in r).toBe(false);
  });

  it('ARC-005 err("x", "why") carries the detail', () => {
    expect(err('x', 'why')).toEqual({ ok: false, error: 'x', detail: 'why' });
  });
});
