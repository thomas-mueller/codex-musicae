import type { DetectionLevelName } from '../../../config/tunables';
import type { InkStroke } from '../../core/annotation';
import type { Rect } from '../../core/geometry';

/** Development-only inspection point for the E2E resource check (NFR-004). Never installed in production builds. */
export interface CacheProbe {
  readonly totalBytes: number;
  readonly budgetBytes: number;
}

/** One edit of the active document's ink, applied through its store (TST-003 property test). */
export type DebugStrokeOp = { readonly op: 'add'; readonly stroke: InkStroke } | { readonly op: 'erase'; readonly id: string } | { readonly op: 'undo' } | { readonly op: 'redo' };

export interface DebugHook {
  readonly cache: { readonly totalBytes: number; readonly budgetBytes: number };
  /** Renders page `pageIndex` of `pdf` at `scale` and returns the detection engine's rectangles (DET-004 E2E). */
  readonly detect?: (pdf: Uint8Array, pageIndex: number, scale: number) => Promise<readonly Rect[]>;
  /** Page indices of the active document in the order detection started them (DET-021 E2E). */
  readonly startedOrder?: () => readonly number[];
  /** Detection state of the active document: whether it is complete and which pages ran (SAV-012, DET-023 E2E). */
  readonly detectionState?: () => { readonly complete: boolean; readonly startedOrder: readonly number[] };
  /** Detected system count per page (null while pending) and the level of the adopted results (TST-002 corpus E2E). */
  readonly systemCounts?: () => { readonly level: string; readonly counts: readonly (number | null)[] };
  /** Starts a re-run at `level` for the active document, as confirming the level dialog does (TST-002 corpus E2E). */
  readonly redetect?: (level: DetectionLevelName) => void;
  /** The strokes of the active document, in model order (TST-003 property test). */
  readonly strokes?: () => readonly InkStroke[];
  /** Applies ink edits to the active document through the store, in order (TST-003 property test). */
  readonly applyOps?: (ops: readonly DebugStrokeOp[]) => void;
  /** Number of strokes in the active document's model (ANN-005 E2E). */
  readonly strokeCount?: () => number;
}

export type DebugHost = { __cm?: DebugHook };

/** Exposes live, read-only cache numbers as `__cm.cache`. */
export function installDebugHook(host: DebugHost, cache: CacheProbe, extras: Partial<Omit<DebugHook, 'cache'>> = {}): void {
  host.__cm = {
    ...extras,
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
