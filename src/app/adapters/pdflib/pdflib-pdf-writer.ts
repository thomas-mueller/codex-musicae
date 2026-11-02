import * as Comlink from 'comlink';

import { TUNABLES } from '../../../config/tunables';
import type { ExistingInk, PdfEdits, PdfWriteError, PdfWriter } from '../../ports/pdf-writer';
import { err } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { PdfWriterWorkerApi } from './pdf-writer-worker-api';
import { mapWriteError } from './write-error';

/** Creates the dedicated pdf-writer worker and its Comlink proxy. */
export function createPdfWriterWorkerApi(): PdfWriterWorkerApi {
  const worker = new Worker(new URL('../workers/pdf-writer.worker', import.meta.url), { type: 'module' });
  return Comlink.wrap<PdfWriterWorkerApi>(worker);
}

/** Main-thread proxy of the pdf-lib worker (SAV-001, SAV-006, SAV-010). The worker is created on first use. */
export class PdfLibWriter implements PdfWriter {
  private worker: PdfWriterWorkerApi | null = null;
  private nextTaskId = 0;
  private readonly key = TUNABLES.saving.metadataFileName;

  constructor(private readonly createWorkerApi: () => PdfWriterWorkerApi = createPdfWriterWorkerApi) {}

  listInk(bytes: Uint8Array): Promise<Result<readonly ExistingInk[], PdfWriteError>> {
    return this.call((worker) => worker.listInk(bytes));
  }

  readEmbeddedJson(bytes: Uint8Array): Promise<Result<string | null, PdfWriteError>> {
    return this.call((worker) => worker.readEmbeddedJson(bytes, this.key));
  }

  apply(bytes: Uint8Array, edits: PdfEdits, signal: AbortSignal): Promise<Result<Uint8Array, PdfWriteError>> {
    if (signal.aborted) {
      return Promise.resolve(err('cancelled'));
    }
    const worker = this.api();
    const taskId = this.nextTaskId++;
    return new Promise((resolve) => {
      const onAbort = (): void => {
        void worker.cancel(taskId).catch(() => undefined);
        resolve(err('cancelled'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      worker.apply(bytes, edits, this.key, taskId).then(
        (result) => resolve(result),
        (thrown: unknown) => resolve(mapWriteError(thrown)),
      ).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  private api(): PdfWriterWorkerApi {
    return (this.worker ??= this.createWorkerApi());
  }

  private async call<T>(run: (worker: PdfWriterWorkerApi) => Promise<Result<T, PdfWriteError>>): Promise<Result<T, PdfWriteError>> {
    try {
      return await run(this.api());
    } catch (thrown) {
      return mapWriteError(thrown);
    }
  }
}
