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

const ROTATE_90 = 90;
const ROTATE_180 = 180;
const ROTATE_270 = 270;

/** What pdf.js reports for a page: `view` = [x0, y0, x1, y1] of the CropBox in user space, `rotate` = /Rotate. */
export interface PageBox {
  readonly view: readonly [number, number, number, number];
  readonly rotate: PageRotation;
}

/** width * height. */
export function rectArea(r: Rect): number {
  return r.width * r.height;
}

/** Smallest rectangle containing both. */
export function rectUnion(a: Rect, b: Rect): Rect {
  const left = Math.min(a.x, b.x);
  const top = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Size of the page in display space: width/height swap for rotate 90 and 270. */
export function pageDisplaySize(box: PageBox): Size {
  const [x0, y0, x1, y1] = box.view;
  const width = x1 - x0;
  const height = y1 - y0;
  return box.rotate === ROTATE_90 || box.rotate === ROTATE_270 ? { width: height, height: width } : { width, height };
}

/**
 * PDF user space -> page display space.
 * rotate 0:   (x - x0, y1 - y)      rotate 90:  (y - y0, x - x0)
 * rotate 180: (x1 - x, y - y0)      rotate 270: (y1 - y, x1 - x)
 */
export function userToDisplay(p: Point, box: PageBox): Point {
  const [x0, y0, x1, y1] = box.view;
  switch (box.rotate) {
    case 0:
      return { x: p.x - x0, y: y1 - p.y };
    case ROTATE_90:
      return { x: p.y - y0, y: p.x - x0 };
    case ROTATE_180:
      return { x: x1 - p.x, y: p.y - y0 };
    case ROTATE_270:
      return { x: y1 - p.y, y: x1 - p.x };
  }
}

/** Exact inverse of `userToDisplay`. */
export function displayToUser(p: Point, box: PageBox): Point {
  const [x0, y0, x1, y1] = box.view;
  switch (box.rotate) {
    case 0:
      return { x: x0 + p.x, y: y1 - p.y };
    case ROTATE_90:
      return { x: x0 + p.y, y: y0 + p.x };
    case ROTATE_180:
      return { x: x1 - p.x, y: y0 + p.y };
    case ROTATE_270:
      return { x: x1 - p.y, y: y1 - p.x };
  }
}

/** Converts a rectangle measured in bitmap pixels to display space by dividing every field by `scale` (pixels per display point). */
export function bitmapRectToDisplay(r: Rect, scale: number): Rect {
  return { x: r.x / scale, y: r.y / scale, width: r.width / scale, height: r.height / scale };
}

/**
 * Largest render scale not above `desiredScale` such that pageWidth*scale * pageHeight*scale <= maxPixels.
 * = min(desiredScale, sqrt(maxPixels / (pageWidth * pageHeight))).
 */
export function fitScaleToPixelCap(
  pageWidth: number,
  pageHeight: number,
  desiredScale: number,
  maxPixels: number,
): number {
  return Math.min(desiredScale, Math.sqrt(maxPixels / (pageWidth * pageHeight)));
}
