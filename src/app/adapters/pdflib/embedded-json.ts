import { PDFDict, PDFHexString, PDFRawStream, PDFString, decodePDFRawStream } from 'pdf-lib';
import type { PDFDocument } from 'pdf-lib';

import { TUNABLES } from '../../../config/tunables';
import { dictOf, name } from './pdf-objects';
import { embeddedFilesRoot, findEntry, setEmbeddedFile } from './name-tree';

const PDF = TUNABLES.pdfWriter;

/** SAV-001: the text of the attachment `key`, or null when the file has none. */
export function readEmbeddedJsonOf(doc: PDFDocument, key: string): string | null {
  const root = embeddedFilesRoot(doc, false);
  const entry = root ? findEntry(root, key) : null;
  if (!entry) {
    return null;
  }
  const spec = doc.context.lookupMaybe(entry.names.get(entry.index + 1), PDFDict);
  const stream = spec ? dictOf(spec, 'EF')?.lookup(name('F')) : undefined;
  return stream instanceof PDFRawStream ? new TextDecoder().decode(decodePDFRawStream(stream).decode()) : null;
}

/** SAV-001, SAV-010: writes (or replaces) the attachment `key` with `text`. */
export function writeEmbeddedJson(doc: PDFDocument, key: string, text: string): void {
  const { context } = doc;
  const bytes = new TextEncoder().encode(text);
  const stream = context.register(
    context.flateStream(bytes, { Type: 'EmbeddedFile', Subtype: PDF.embeddedFileMime, Params: { Size: bytes.length } }),
  );
  const spec = context.register(
    context.obj({
      Type: 'Filespec',
      F: PDFString.of(key),
      UF: PDFHexString.fromText(key),
      EF: { F: stream },
      AFRelationship: 'Data',
      Desc: PDFHexString.fromText(PDF.embeddedFileDescription),
    }),
  );
  setEmbeddedFile(doc, key, spec);
}
