/**
 * Fixtures: core/geometry
 * Requirements: SAV-007, DET-009, NFR-006
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { PageBox, Point, Rect, Size } from '../geometry';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const rectAreaCases: ReadonlyArray<{ id: string; rect: Rect; expected: number }> = [
  { id: 'G-A-0', rect: r(0, 0, 10, 20), expected: 200 },
  { id: 'G-A-1', rect: r(5, 5, 0, 10), expected: 0 },
];

export const rectUnionCases: ReadonlyArray<{ id: string; a: Rect; b: Rect; expected: Rect }> = [
  { id: 'G-U-0', a: r(0, 0, 10, 10), b: r(5, 5, 10, 10), expected: r(0, 0, 15, 15) },
  { id: 'G-U-1', a: r(50, 80, 900, 240), b: r(50, 380, 900, 240), expected: r(50, 80, 900, 540) },
  { id: 'G-U-2', a: r(0, 0, 10, 10), b: r(2, 2, 3, 3), expected: r(0, 0, 10, 10) },
];

export const bitmapRectToDisplayCases: ReadonlyArray<{ id: string; rect: Rect; scale: number; expected: Rect }> = [
  { id: 'G-B-0', rect: r(100, 200, 300, 400), scale: 2, expected: r(50, 100, 150, 200) },
  { id: 'G-B-1', rect: r(150, 300, 450, 600), scale: 1.5, expected: r(100, 200, 300, 400) },
];

export const pageDisplaySizeCases: ReadonlyArray<{ id: string; req: string; box: PageBox; size: Size }> = [
  {
    id: 'G-S-rot0',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 0 },
    size: { width: 600, height: 800 },
  },
  {
    id: 'G-S-rot0Offset',
    req: 'SAV-007',
    box: { view: [10, 20, 610, 820], rotate: 0 },
    size: { width: 600, height: 800 },
  },
  {
    id: 'G-S-rot90',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 90 },
    size: { width: 800, height: 600 },
  },
  {
    id: 'G-S-rot180',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 180 },
    size: { width: 600, height: 800 },
  },
  {
    id: 'G-S-rot270',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 270 },
    size: { width: 800, height: 600 },
  },
  {
    id: 'G-S-rot90Offset',
    req: 'SAV-007',
    box: { view: [10, 20, 610, 820], rotate: 90 },
    size: { width: 800, height: 600 },
  },
];

/** Both directions: userToDisplay(user) = display and displayToUser(display) = user. */
export const pageTransformCases: ReadonlyArray<{ id: string; req: string; box: PageBox; user: Point; display: Point }> = [
  {
    id: 'G-T-rot0-0',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 0 },
    user: { x: 100, y: 200 },
    display: { x: 100, y: 600 },
  },
  {
    id: 'G-T-rot0-1',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 0 },
    user: { x: 0, y: 0 },
    display: { x: 0, y: 800 },
  },
  {
    id: 'G-T-rot0-2',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 0 },
    user: { x: 600, y: 800 },
    display: { x: 600, y: 0 },
  },
  {
    id: 'G-T-rot0Offset-0',
    req: 'SAV-007',
    box: { view: [10, 20, 610, 820], rotate: 0 },
    user: { x: 110, y: 220 },
    display: { x: 100, y: 600 },
  },
  {
    id: 'G-T-rot0Offset-1',
    req: 'SAV-007',
    box: { view: [10, 20, 610, 820], rotate: 0 },
    user: { x: 10, y: 20 },
    display: { x: 0, y: 800 },
  },
  {
    id: 'G-T-rot90-0',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 90 },
    user: { x: 100, y: 200 },
    display: { x: 200, y: 100 },
  },
  {
    id: 'G-T-rot90-1',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 90 },
    user: { x: 0, y: 0 },
    display: { x: 0, y: 0 },
  },
  {
    id: 'G-T-rot90-2',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 90 },
    user: { x: 600, y: 800 },
    display: { x: 800, y: 600 },
  },
  {
    id: 'G-T-rot180-0',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 180 },
    user: { x: 100, y: 200 },
    display: { x: 500, y: 200 },
  },
  {
    id: 'G-T-rot180-1',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 180 },
    user: { x: 0, y: 0 },
    display: { x: 600, y: 0 },
  },
  {
    id: 'G-T-rot180-2',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 180 },
    user: { x: 600, y: 800 },
    display: { x: 0, y: 800 },
  },
  {
    id: 'G-T-rot270-0',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 270 },
    user: { x: 100, y: 200 },
    display: { x: 600, y: 500 },
  },
  {
    id: 'G-T-rot270-1',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 270 },
    user: { x: 0, y: 0 },
    display: { x: 800, y: 600 },
  },
  {
    id: 'G-T-rot270-2',
    req: 'SAV-007',
    box: { view: [0, 0, 600, 800], rotate: 270 },
    user: { x: 600, y: 800 },
    display: { x: 0, y: 0 },
  },
  {
    id: 'G-T-rot90Offset-0',
    req: 'SAV-007',
    box: { view: [10, 20, 610, 820], rotate: 90 },
    user: { x: 110, y: 220 },
    display: { x: 200, y: 100 },
  },
];

export const fitScaleToPixelCapCases: ReadonlyArray<{ id: string; req: string; pageWidth: number; pageHeight: number; desiredScale: number; maxPixels: number; expected: number }> = [
  {
    id: 'G-C-0',
    req: 'NFR-006',
    pageWidth: 600,
    pageHeight: 800,
    desiredScale: 2.5,
    maxPixels: 12000000,
    expected: 2.5,
  },
  {
    id: 'G-C-1',
    req: 'NFR-006',
    pageWidth: 2000,
    pageHeight: 3000,
    desiredScale: 2.5,
    maxPixels: 12000000,
    expected: 1.4142135623730951,
  },
  {
    id: 'G-C-2',
    req: 'NFR-006',
    pageWidth: 595,
    pageHeight: 842,
    desiredScale: 1.5,
    maxPixels: 12000000,
    expected: 1.5,
  },
  {
    id: 'G-C-3',
    req: 'NFR-006',
    pageWidth: 595,
    pageHeight: 842,
    desiredScale: 1,
    maxPixels: 100000,
    expected: 0.44677151042852925,
  },
];
