import type { PDFDocument } from 'pdf-lib';

import type { PdfWriteError } from '../../ports/pdf-writer';
import { ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import { applyEdits, loadDocument } from './apply-edits';
import { readEmbeddedJsonOf } from './embedded-json';
import { listInkOf } from './ink-list';
import type { PdfWriterWorkerApi } from './pdf-writer-worker-api';
import { mapWriteError } from './write-error';

/** Runs `read` on the loaded document and maps anything thrown to a port error. */
async function withDocument<T>(
  bytes: Uint8Array,
  read: (doc: PDFDocument) => T,
): Promise<Result<T, PdfWriteError>> {
  const loaded = await loadDocument(bytes);
  if (!loaded.ok) {
    return loaded;
  }
  try {
    return ok(read(loaded.value));
  } catch (thrown) {
    return mapWriteError(thrown);
  }
}

/** The pdf-lib implementation behind the worker; also used directly by specs. */
export function createPdfWriterApi(): PdfWriterWorkerApi {
  const cancelled = new Set<number>();
  return {
    listInk: (bytes) => withDocument(bytes, listInkOf),
    readEmbeddedJson: (bytes, key) => withDocument(bytes, (doc) => readEmbeddedJsonOf(doc, key)),
    async apply(bytes, edits, key, taskId) {
      try {
        return await applyEdits(bytes, edits, key, () => cancelled.has(taskId));
      } finally {
        cancelled.delete(taskId);
      }
    },
    async cancel(taskId) {
      cancelled.add(taskId);
    },
  };
}

