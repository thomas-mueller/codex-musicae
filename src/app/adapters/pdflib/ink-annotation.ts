import { PDFString } from 'pdf-lib';
import type { PDFDocument, PDFRef } from 'pdf-lib';

import { TUNABLES } from '../../../config/tunables';
import type { InkToAdd } from '../../ports/pdf-writer';
import { fixed, rounded } from './pdf-objects';

const PDF = TUNABLES.pdfWriter;
const HEX_PREFIX_LENGTH = 1;

function rgbOf(hex: string): [number, number, number] {
  const digits = hex.slice(HEX_PREFIX_LENGTH);
  const channel = (i: number): number =>
    parseInt(digits.slice(i * PDF.hexDigitsPerChannel, (i + 1) * PDF.hexDigitsPerChannel), PDF.hexRadix) / PDF.colorByteMax;
  return [channel(0), channel(1), channel(2)];
}

/** The appearance stream: round caps and joins, one polyline; a single point is a zero-length line. */
function contentOf(ink: InkToAdd, needsGraphicsState: boolean): string {
  const [r, g, b] = rgbOf(ink.color);
  const [first, ...rest] = ink.points;
  const lines = ['q', `${fixed(r)} ${fixed(g)} ${fixed(b)} RG`, `${fixed(ink.widthPt)} w`, '1 J 1 j'];
  if (needsGraphicsState) {
    lines.push('/GS gs');
  }
  if (first) {
    lines.push(`${fixed(first.x)} ${fixed(first.y)} m`);
    const tail = rest.length > 0 ? rest : [first];
    for (const p of tail) {
      lines.push(`${fixed(p.x)} ${fixed(p.y)} l`);
    }
  }
  lines.push('S', 'Q');
  return lines.join('\n');
}

/** Creates the appearance stream and the `/Ink` annotation of one stroke (SAV-006); returns the annotation, not yet on a page. */
export function buildInk(doc: PDFDocument, ink: InkToAdd): PDFRef {
  const { context } = doc;
  const xs = ink.points.map((p) => p.x);
  const ys = ink.points.map((p) => p.y);
  const pad = ink.widthPt / 2 + PDF.bboxPaddingPt;
  const rect = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad].map(rounded);
  const needsGraphicsState = ink.opacity < 1 || ink.multiply;
  const [r, g, b] = rgbOf(ink.color);

  const form = context.stream(contentOf(ink, needsGraphicsState), {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: rect,
    Resources: needsGraphicsState
      ? { ExtGState: { GS: { Type: 'ExtGState', CA: ink.opacity, ca: ink.opacity, BM: ink.multiply ? 'Multiply' : 'Normal' } } }
      : {},
  });
  const annotation = context.obj({
    Type: 'Annot',
    Subtype: 'Ink',
    Rect: rect,
    InkList: [ink.points.flatMap((p) => [rounded(p.x), rounded(p.y)])],
    C: [rounded(r), rounded(g), rounded(b)],
    BS: { W: ink.widthPt },
    CA: ink.opacity,
    NM: PDFString.of(ink.strokeId),
    F: PDF.annotationFlags,
    T: PDFString.of(PDF.author),
    AP: { N: context.register(form) },
  });
  return context.register(annotation);
}
