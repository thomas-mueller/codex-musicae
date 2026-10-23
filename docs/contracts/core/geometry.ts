/**
 * core/geometry — pure geometry and coordinate transforms.
 * Requirements: DET-009, DET-011, SAV-007, NFR-006.
 * Page display space = pdf.js scale-1 viewport (CropBox and /Rotate applied), origin top-left, PDF points.
 * PDF user space = the PDF's own coordinates, origin bottom-left of the CropBox, y up.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Axis-aligned rectangle, origin top-left, y down (display space unless stated otherwise). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PageRotation = 0 | 90 | 180 | 270;

/** What pdf.js reports for a page: `view` = [x0, y0, x1, y1] of the CropBox in user space, `rotate` = /Rotate. */
export interface PageBox {
  readonly view: readonly [number, number, number, number];
  readonly rotate: PageRotation;
}

/** width * height. */
export function rectArea(_r: Rect): number {
  throw new Error('not implemented');
}

/** Smallest rectangle containing both. */
export function rectUnion(_a: Rect, _b: Rect): Rect {
  throw new Error('not implemented');
}

/** Size of the page in display space: width/height swap for rotate 90 and 270. */
export function pageDisplaySize(_box: PageBox): Size {
  throw new Error('not implemented');
}

/**
 * PDF user space -> page display space.
 * rotate 0:   (x - x0, y1 - y)      rotate 90:  (y - y0, x - x0)
 * rotate 180: (x1 - x, y - y0)      rotate 270: (y1 - y, x1 - x)
 */
export function userToDisplay(_p: Point, _box: PageBox): Point {
  throw new Error('not implemented');
}

/** Exact inverse of `userToDisplay`. */
export function displayToUser(_p: Point, _box: PageBox): Point {
  throw new Error('not implemented');
}

/** Converts a rectangle measured in bitmap pixels to display space by dividing every field by `scale` (pixels per display point). */
export function bitmapRectToDisplay(_r: Rect, _scale: number): Rect {
  throw new Error('not implemented');
}

/**
 * Largest render scale not above `desiredScale` such that pageWidth*scale * pageHeight*scale <= maxPixels.
 * = min(desiredScale, sqrt(maxPixels / (pageWidth * pageHeight))).
 */
export function fitScaleToPixelCap(
  _pageWidth: number,
  _pageHeight: number,
  _desiredScale: number,
  _maxPixels: number,
): number {
  throw new Error('not implemented');
}
