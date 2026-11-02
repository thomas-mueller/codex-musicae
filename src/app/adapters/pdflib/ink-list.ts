import { PDFArray, PDFDict, PDFRef } from 'pdf-lib';
import type { PDFDocument } from 'pdf-lib';

import { TUNABLES } from '../../../config/tunables';
import type { Point } from '../../core/geometry';
import type { ExistingInk } from '../../ports/pdf-writer';
import { arrayOf, dictOf, name, numberOf, numbersOf, textOf } from './pdf-objects';

const PDF = TUNABLES.pdfWriter;

function hexByte(unit: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, unit)) * PDF.colorByteMax);
  return byte.toString(PDF.hexRadix).padStart(PDF.hexDigitsPerChannel, '0');
}

/** `/C` with 1 (gray), 3 (RGB) or 4 (CMYK) components to '#RRGGBB'; anything else is the default ink color. */
export function colorOf(components: readonly number[]): string {
  const [a = 0, b = 0, c = 0, k = 0] = components;
  switch (components.length) {
    case PDF.grayComponents:
      return `#${hexByte(a).repeat(PDF.rgbComponents)}`;
    case PDF.rgbComponents:
      return `#${hexByte(a)}${hexByte(b)}${hexByte(c)}`;
    case PDF.cmykComponents:
      return `#${hexByte((1 - a) * (1 - k))}${hexByte((1 - b) * (1 - k))}${hexByte((1 - c) * (1 - k))}`;
    default:
      return PDF.defaultInkColor;
  }
}

/** All `/InkList` sub-arrays concatenated into points. */
function pointsOf(annotation: PDFDict): Point[] {
  const lists = arrayOf(annotation, 'InkList');
  const flat: number[] = [];
  for (let i = 0; lists && i < lists.size(); i++) {
    flat.push(...numbersOf(lists.lookupMaybe(i, PDFArray)));
  }
  const points: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    points.push({ x: flat[i] as number, y: flat[i + 1] as number });
  }
  return points;
}

function widthOf(annotation: PDFDict): number {
  const border = dictOf(annotation, 'BS');
  const fromStyle = border ? numberOf(border.lookup(name('W'))) : null;
  if (fromStyle !== null) {
    return fromStyle;
  }
  const legacy = arrayOf(annotation, 'Border');
  const fromBorder = legacy ? numberOf(legacy.lookup(PDF.borderWidthIndex)) : null;
  return fromBorder ?? PDF.defaultInkWidthPt;
}

/** The ink annotations of one page that are indirect objects (the others cannot be addressed for removal). */
export function inkOfPage(doc: PDFDocument, pageIndex: number, annots: PDFArray): ExistingInk[] {
  const out: ExistingInk[] = [];
  for (let i = 0; i < annots.size(); i++) {
    const entry = annots.get(i);
    if (!(entry instanceof PDFRef)) {
      continue;
    }
    const annotation = doc.context.lookupMaybe(entry, PDFDict);
    if (!annotation || annotation.lookup(name('Subtype'))?.toString() !== '/Ink') {
      continue;
    }
    const strokeId = textOf(annotation.lookup(name('NM')));
    const colorArray = arrayOf(annotation, 'C');
    const opacity = numberOf(annotation.lookup(name('CA'))) ?? 1;
    out.push({
      pageIndex,
      annotationRef: strokeId !== null ? `nm:${strokeId}` : `obj:${entry.objectNumber}`,
      strokeId,
      points: pointsOf(annotation),
      color: colorArray ? colorOf(numbersOf(colorArray)) : PDF.defaultInkColor,
      widthPt: widthOf(annotation),
      opacity,
    });
  }
  return out;
}

export function listInkOf(doc: PDFDocument): ExistingInk[] {
  return doc.getPages().flatMap((page, pageIndex) => {
    const annots = page.node.lookupMaybe(name('Annots'), PDFArray);
    return annots ? inkOfPage(doc, pageIndex, annots) : [];
  });
}
