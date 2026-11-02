import type { PdfWriteError } from '../../ports/pdf-writer';
import { err } from '../../ports/result';
import type { Result } from '../../ports/result';

const OUT_OF_MEMORY_PATTERN = /memory|alloc/i;

/** Thrown inside the worker when the task was cancelled between two steps. */
export class Cancelled extends Error {}

/** Maps anything thrown to a port error. Kept free of pdf-lib: the main-thread proxy imports it. */
export function mapWriteError(thrown: unknown): Result<never, PdfWriteError> {
  if (thrown instanceof Cancelled) {
    return err('cancelled');
  }
  const detail = thrown instanceof Error ? thrown.message : String(thrown);
  return err(thrown instanceof RangeError || OUT_OF_MEMORY_PATTERN.test(detail) ? 'out-of-memory' : 'unknown', detail);
}
