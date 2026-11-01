import type { DetectionError } from '../../ports/detection-engine';

const OUT_OF_MEMORY_PATTERN = /memory|alloc/i;

/** Maps anything thrown while extracting to a port error: allocation failures to `out-of-memory`, the rest to `unknown`. */
export function mapDetectionError(thrown: unknown): { error: Exclude<DetectionError, 'cancelled'>; detail: string } {
  const detail = thrown instanceof Error ? thrown.message : String(thrown);
  if (thrown instanceof RangeError || OUT_OF_MEMORY_PATTERN.test(detail)) return { error: 'out-of-memory', detail };
  return { error: 'unknown', detail };
}
