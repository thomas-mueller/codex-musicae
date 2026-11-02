import type { ExistingInk, PdfEdits, PdfWriteError } from '../../ports/pdf-writer';
import type { Result } from '../../ports/result';

/** The API the pdf-writer worker exposes through Comlink; `AbortSignal` cannot cross it, so `apply` takes a task id. */
export interface PdfWriterWorkerApi {
  listInk(bytes: Uint8Array): Promise<Result<readonly ExistingInk[], PdfWriteError>>;
  readEmbeddedJson(bytes: Uint8Array, key: string): Promise<Result<string | null, PdfWriteError>>;
  apply(bytes: Uint8Array, edits: PdfEdits, key: string, taskId: number): Promise<Result<Uint8Array, PdfWriteError>>;
  /** Makes the running or upcoming `apply` of `taskId` stop at its next step. */
  cancel(taskId: number): Promise<void>;
}
