import { PDFArray, PDFDict, PDFRef } from 'pdf-lib';
import type { PDFDocument } from 'pdf-lib';

import { dictOf, name, textOf } from './pdf-objects';

const NM_PREFIX = 'nm:';
const OBJ_PREFIX = 'obj:';

function matches(doc: PDFDocument, entry: PDFRef, annotationRef: string): boolean {
  if (annotationRef.startsWith(OBJ_PREFIX)) {
    return String(entry.objectNumber) === annotationRef.slice(OBJ_PREFIX.length);
  }
  if (annotationRef.startsWith(NM_PREFIX)) {
    const annotation = doc.context.lookupMaybe(entry, PDFDict);
    return annotation !== undefined && textOf(annotation.lookup(name('NM'))) === annotationRef.slice(NM_PREFIX.length);
  }
  return false;
}

/** Deletes the annotation, its normal appearance stream and its popup from the file. */
function deleteAnnotation(doc: PDFDocument, ref: PDFRef): void {
  const annotation = doc.context.lookupMaybe(ref, PDFDict);
  const normal = annotation ? dictOf(annotation, 'AP')?.get(name('N')) : undefined;
  const popup = annotation?.get(name('Popup'));
  for (const child of [normal, popup]) {
    if (child instanceof PDFRef) {
      doc.context.delete(child);
    }
  }
  doc.context.delete(ref);
}

/** SAV-006: removes the annotation `annotationRef` (`nm:<NM>` or `obj:<n>`) from the page; an unknown reference is already gone. */
export function removeInk(doc: PDFDocument, pageIndex: number, annotationRef: string): void {
  const annots = doc.getPages()[pageIndex]?.node.lookupMaybe(name('Annots'), PDFArray);
  for (let i = 0; annots && i < annots.size(); i++) {
    const entry = annots.get(i);
    if (entry instanceof PDFRef && matches(doc, entry, annotationRef)) {
      annots.remove(i);
      deleteAnnotation(doc, entry);
      return;
    }
  }
}
