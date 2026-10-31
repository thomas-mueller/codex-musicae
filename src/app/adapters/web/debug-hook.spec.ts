import { describe, expect, it } from 'vitest';

import { installDebugHook } from './debug-hook';
import type { DebugHost } from './debug-hook';

describe('installDebugHook', () => {
  it('NFR-004 exposes the live cache numbers', () => {
    const host: DebugHost = {};
    const cache = { totalBytes: 10, budgetBytes: 100 };
    installDebugHook(host, cache);
    expect(host.__cm?.cache).toEqual({ totalBytes: 10, budgetBytes: 100 });
    cache.totalBytes = 42;
    expect(host.__cm?.cache.totalBytes).toBe(42);
  });

  it('NFR-004 leaves the host untouched until it is installed', () => {
    const host: DebugHost = {};
    expect(host.__cm).toBeUndefined();
  });
});
