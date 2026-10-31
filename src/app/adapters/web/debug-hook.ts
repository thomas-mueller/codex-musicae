/** Development-only inspection point for the E2E resource check (NFR-004). Never installed in production builds. */
export interface CacheProbe {
  readonly totalBytes: number;
  readonly budgetBytes: number;
}

export interface DebugHook {
  readonly cache: { readonly totalBytes: number; readonly budgetBytes: number };
}

export type DebugHost = { __cm?: DebugHook };

/** Exposes live, read-only cache numbers as `__cm.cache`. */
export function installDebugHook(host: DebugHost, cache: CacheProbe): void {
  host.__cm = {
    cache: {
      get totalBytes() {
        return cache.totalBytes;
      },
      get budgetBytes() {
        return cache.budgetBytes;
      },
    },
  };
}
