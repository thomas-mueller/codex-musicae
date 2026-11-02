import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib';
import type { PDFObject } from 'pdf-lib';

import { TUNABLES } from '../../../config/tunables';

const PDF = TUNABLES.pdfWriter;

export const name = (n: string): PDFName => PDFName.of(n);

/** Fixed-point text without exponent notation, for content streams. */
export function fixed(value: number): string {
  return String(Number(value.toFixed(PDF.numberDecimals)));
}

/** Rounds to the writer's precision; used for numbers stored as PDF objects. */
export function rounded(value: number): number {
  return Number(value.toFixed(PDF.numberDecimals));
}

export function textOf(object: PDFObject | undefined): string | null {
  return object instanceof PDFString || object instanceof PDFHexString ? object.decodeText() : null;
}

export function numberOf(object: PDFObject | undefined): number | null {
  return object instanceof PDFNumber ? object.asNumber() : null;
}

/** All numbers of an array, skipping anything that is not a number. */
export function numbersOf(array: PDFArray | undefined): number[] {
  const out: number[] = [];
  for (let i = 0; array && i < array.size(); i++) {
    const n = numberOf(array.lookup(i));
    if (n !== null) {
      out.push(n);
    }
  }
  return out;
}

export function dictOf(parent: PDFDict, key: string): PDFDict | undefined {
  return parent.lookupMaybe(name(key), PDFDict);
}

export function arrayOf(parent: PDFDict, key: string): PDFArray | undefined {
  return parent.lookupMaybe(name(key), PDFArray);
}
