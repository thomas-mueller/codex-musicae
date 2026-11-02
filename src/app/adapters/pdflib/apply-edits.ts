import { PDFArray, PDFDocument } from 'pdf-lib';

import type { PdfEdits, PdfWriteError } from '../../ports/pdf-writer';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import { writeEmbeddedJson } from './embedded-json';
import { buildInk } from './ink-annotation';
import { name } from './pdf-objects';
import { removeInk } from './remove-ink';
import { Cancelled, mapWriteError } from './write-error';

/** Loads without touching the document information (SAV-013); encrypted or damaged files give `invalid-pdf`. */
export async function loadDocument(bytes: Uint8Array): Promise<Result<PDFDocument, PdfWriteError>> {
  try {
    return ok(await PDFDocument.load(bytes, { updateMetadata: false }));
  } catch {
    return err('invalid-pdf');
  }
}

/** SAV-006, SAV-010, SAV-013: remove ink, add ink, replace the attachment; everything else stays as it was. */
export async function applyEdits(
  bytes: Uint8Array,
  edits: PdfEdits,
  key: string,
  isCancelled: () => boolean,
): Promise<Result<Uint8Array, PdfWriteError>> {
  const checkpoint = (): void => {
    if (isCancelled()) {
      throw new Cancelled();
    }
  };
  try {
    checkpoint();
    const loaded = await loadDocument(bytes);
    if (!loaded.ok) {
      return loaded;
    }
    const doc = loaded.value;
    checkpoint();
    for (const removal of edits.removeInk) {
      removeInk(doc, removal.pageIndex, removal.annotationRef);
    }
    checkpoint();
    for (const ink of edits.addInk) {
      const page = doc.getPages()[ink.pageIndex];
      if (!page) {
        continue;
      }
      const annots = page.node.lookupMaybe(name('Annots'), PDFArray) ?? doc.context.obj([]);
      annots.push(buildInk(doc, ink));
      page.node.set(name('Annots'), annots);
      checkpoint();
    }
    if (edits.embeddedJson !== null) {
      writeEmbeddedJson(doc, key, edits.embeddedJson);
    }
    checkpoint();
    return ok(await doc.save({ useObjectStreams: false }));
  } catch (thrown) {
    return mapWriteError(thrown);
  }
}
