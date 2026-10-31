import type { Rect } from '../../core/geometry';

/** Development-only inspection point for the E2E resource check (NFR-004). Never installed in production builds. */
export interface CacheProbe {
  readonly totalBytes: number;
  readonly budgetBytes: number;
}

export interface DebugHook {
  readonly cache: { readonly totalBytes: number; readonly budgetBytes: number };
  /** Renders page `pageIndex` of `pdf` at `scale` and returns the detection engine's rectangles (DET-004 E2E). */
  readonly detect?: (pdf: Uint8Array, pageIndex: number, scale: number) => Promise<readonly Rect[]>;
}

export type DebugHost = { __cm?: DebugHook };

/** Exposes live, read-only cache numbers as `__cm.cache`. */
export function installDebugHook(host: DebugHost, cache: CacheProbe, detect?: DebugHook['detect']): void {
  host.__cm = {
    ...(detect ? { detect } : {}),
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
