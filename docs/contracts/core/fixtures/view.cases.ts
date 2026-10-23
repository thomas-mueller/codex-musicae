/**
 * Fixtures: core/view
 * Requirements: ORG-003, ORG-004, NAV-013, NAV-014, NFR-007
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Point, Rect, Size } from '../geometry';
import type { PageLayout, ViewState, ZoomLimits } from '../view';

const r = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

export const fitScaleCases: ReadonlyArray<{ id: string; req: string; content: Size; viewport: Size; mode: 'contain' | 'width'; expected: number }> = [
  {
    id: 'F1',
    req: 'ORG-003',
    content: { width: 940, height: 940 },
    viewport: { width: 1000, height: 500 },
    mode: 'contain',
    expected: 0.5319148936170213,
  },
  {
    id: 'F2',
    req: 'ORG-003',
    content: { width: 940, height: 940 },
    viewport: { width: 1000, height: 500 },
    mode: 'width',
    expected: 1.0638297872340425,
  },
  {
    id: 'F3',
    req: 'ORG-003',
    content: { width: 600, height: 800 },
    viewport: { width: 1200, height: 800 },
    mode: 'contain',
    expected: 1,
  },
  {
    id: 'F4',
    req: 'ORG-003',
    content: { width: 600, height: 800 },
    viewport: { width: 1200, height: 800 },
    mode: 'width',
    expected: 2,
  },
];

export const orgZoomLimitsCases: ReadonlyArray<{ id: string; req: string; page: Size; viewport: Size; maxZoom: number; expected: ZoomLimits }> = [
  {
    id: 'OZ1',
    req: 'ORG-003',
    page: { width: 600, height: 800 },
    viewport: { width: 1000, height: 700 },
    maxZoom: 4,
    expected: { min: 0.525, max: 4 },
  },
  {
    id: 'OZ2',
    req: 'ORG-003',
    page: { width: 600, height: 800 },
    viewport: { width: 600, height: 1200 },
    maxZoom: 4,
    expected: { min: 1, max: 4 },
  },
  {
    id: 'OZ3',
    req: 'ORG-003',
    page: { width: 600, height: 800 },
    viewport: { width: 1200, height: 800 },
    maxZoom: 4,
    expected: { min: 0.5, max: 4 },
  },
];

export const scrollAfterZoomCases: ReadonlyArray<{ id: string; req: string; scroll: Point; anchor: Point; oldZoom: number; newZoom: number; expected: Point }> = [
  {
    id: 'SC1',
    req: 'NAV-013',
    scroll: { x: 0, y: 100 },
    anchor: { x: 500, y: 300 },
    oldZoom: 1,
    newZoom: 2,
    expected: { x: 500, y: 500 },
  },
  {
    id: 'SC2',
    req: 'NAV-013',
    scroll: { x: 100, y: 100 },
    anchor: { x: 0, y: 0 },
    oldZoom: 2,
    newZoom: 1,
    expected: { x: 50, y: 50 },
  },
  {
    id: 'SC3',
    req: 'NAV-013',
    scroll: { x: 10, y: 20 },
    anchor: { x: 5, y: 5 },
    oldZoom: 1.5,
    newZoom: 1.5,
    expected: { x: 10, y: 20 },
  },
];

export const layoutPagesCases: ReadonlyArray<{ id: string; req: string; sizes: Size[]; scale: number; gap: number; expected: PageLayout[] }> = [
  {
    id: 'LY1',
    req: 'ORG-004',
    sizes: [{ width: 600, height: 800 }, { width: 600, height: 800 }, { width: 800, height: 600 }],
    scale: 0.5,
    gap: 10,
    expected: [
      { top: 0, height: 400, width: 300 },
      { top: 410, height: 400, width: 300 },
      { top: 820, height: 300, width: 400 },
    ],
  },
  { id: 'LY2', req: 'ORG-004', sizes: [], scale: 1, gap: 10, expected: [] },
];

/** `layoutFrom` names the layoutPagesCases entry whose `expected` layout is used. */
export const pageAtOffsetCases: ReadonlyArray<{ id: string; req: string; layoutFrom: 'LY1' | 'LY2'; y: number; gap: number; expected: number }> = [
  { id: 'PA1', req: 'ORG-004', layoutFrom: 'LY1', y: -5, gap: 10, expected: 0 },
  { id: 'PA2', req: 'ORG-004', layoutFrom: 'LY1', y: 0, gap: 10, expected: 0 },
  { id: 'PA3', req: 'ORG-004', layoutFrom: 'LY1', y: 404, gap: 10, expected: 0 },
  { id: 'PA4', req: 'ORG-004', layoutFrom: 'LY1', y: 405, gap: 10, expected: 1 },
  { id: 'PA5', req: 'ORG-004', layoutFrom: 'LY1', y: 814, gap: 10, expected: 1 },
  { id: 'PA6', req: 'ORG-004', layoutFrom: 'LY1', y: 815, gap: 10, expected: 2 },
  { id: 'PA7', req: 'ORG-004', layoutFrom: 'LY1', y: 2000, gap: 10, expected: 2 },
  { id: 'PA8', req: 'ORG-004', layoutFrom: 'LY2', y: 5, gap: 10, expected: -1 },
];

/** Viewport 800 x 600 for clampPan and zoomAround; zoomAround uses fitted 800 x 600 and limits 1..4. */
export const clampPanCases: ReadonlyArray<{ id: string; req: string; view: ViewState; fitted: Size; viewport: Size; expected: ViewState }> = [
  {
    id: 'CP1',
    req: 'NAV-014',
    view: { zoom: 2, panX: 500, panY: -500 },
    fitted: { width: 400, height: 300 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 2, panX: 0, panY: 0 },
  },
  {
    id: 'CP2',
    req: 'NAV-014',
    view: { zoom: 3, panX: 500, panY: -500 },
    fitted: { width: 400, height: 300 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 3, panX: 200, panY: -150 },
  },
  {
    id: 'CP3',
    req: 'NAV-014',
    view: { zoom: 1.5, panX: 50, panY: 50 },
    fitted: { width: 400, height: 300 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 1.5, panX: 0, panY: 0 },
  },
  {
    id: 'CP4',
    req: 'NAV-014',
    view: { zoom: 2, panX: 100, panY: -20 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 2, panX: 100, panY: -20 },
  },
];

export const tilesCoveringCases: ReadonlyArray<{ id: string; req: string; name: string; visible: Rect; content: Size; tileSize: number; expected: Rect[] }> = [
  {
    id: 'TL1',
    req: 'NFR-007',
    name: 'visible area spanning four tiles',
    visible: r(900, 1000, 500, 600),
    content: { width: 2500, height: 3000 },
    tileSize: 1024,
    expected: [r(0, 0, 1024, 1024), r(1024, 0, 1024, 1024), r(0, 1024, 1024, 1024), r(1024, 1024, 1024, 1024)],
  },
  {
    id: 'TL2',
    req: 'NFR-007',
    name: 'visible edge exactly on a tile boundary touches only one column',
    visible: r(0, 0, 1024, 500),
    content: { width: 2500, height: 3000 },
    tileSize: 1024,
    expected: [r(0, 0, 1024, 1024)],
  },
  {
    id: 'TL3',
    req: 'NFR-007',
    name: 'tiles at the content edge are clipped',
    visible: r(2000, 2900, 500, 100),
    content: { width: 2500, height: 3000 },
    tileSize: 1024,
    expected: [r(1024, 2048, 1024, 952), r(2048, 2048, 452, 952)],
  },
  {
    id: 'TL4',
    req: 'NFR-007',
    name: 'visible rectangle outside the content',
    visible: r(5000, 5000, 100, 100),
    content: { width: 2500, height: 3000 },
    tileSize: 1024,
    expected: [],
  },
  {
    id: 'TL5',
    req: 'NFR-007',
    name: 'content smaller than one tile',
    visible: r(10, 10, 50, 50),
    content: { width: 300, height: 200 },
    tileSize: 1024,
    expected: [r(0, 0, 300, 200)],
  },
  {
    id: 'TL6',
    req: 'NFR-007',
    name: 'visible rectangle larger than the content',
    visible: r(-100, -100, 5000, 5000),
    content: { width: 1500, height: 1100 },
    tileSize: 1024,
    expected: [r(0, 0, 1024, 1024), r(1024, 0, 476, 1024), r(0, 1024, 1024, 76), r(1024, 1024, 476, 76)],
  },
];

export const zoomAroundCases: ReadonlyArray<{
  id: string; req: string; name: string; view: ViewState; factor: number; anchor: Point; limits: ZoomLimits; fitted: Size; viewport: Size; expected: ViewState;
}> = [
  {
    id: 'ZA1',
    req: 'NAV-013, NAV-014',
    name: 'zoom in around a point right of center',
    view: { zoom: 1, panX: 0, panY: 0 },
    factor: 2,
    anchor: { x: 600, y: 300 },
    limits: { min: 1, max: 4 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 2, panX: -200, panY: 0 },
  },
  {
    id: 'ZA2',
    req: 'NAV-013, NAV-014',
    name: 'zoom in again around the same point',
    view: { zoom: 2, panX: -200, panY: 0 },
    factor: 2,
    anchor: { x: 600, y: 300 },
    limits: { min: 1, max: 4 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 4, panX: -600, panY: 0 },
  },
  {
    id: 'ZA3',
    req: 'NAV-013, NAV-014',
    name: 'factor above the limit is clamped to max',
    view: { zoom: 1, panX: 0, panY: 0 },
    factor: 10,
    anchor: { x: 400, y: 300 },
    limits: { min: 1, max: 4 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 4, panX: 0, panY: 0 },
  },
  {
    id: 'ZA4',
    req: 'NAV-013, NAV-014',
    name: 'zoom out below the minimum stays at fit',
    view: { zoom: 1, panX: 0, panY: 0 },
    factor: 0.5,
    anchor: { x: 600, y: 300 },
    limits: { min: 1, max: 4 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 1, panX: 0, panY: 0 },
  },
  {
    id: 'ZA5',
    req: 'NAV-013, NAV-014',
    name: 'zooming out to fit recenters',
    view: { zoom: 2, panX: -200, panY: 0 },
    factor: 0.5,
    anchor: { x: 600, y: 300 },
    limits: { min: 1, max: 4 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 1, panX: 0, panY: 0 },
  },
  {
    id: 'ZA6',
    req: 'NAV-013, NAV-014',
    name: 'zoom around the center keeps pan at 0',
    view: { zoom: 1, panX: 0, panY: 0 },
    factor: 2,
    anchor: { x: 400, y: 300 },
    limits: { min: 1, max: 4 },
    fitted: { width: 800, height: 600 },
    viewport: { width: 800, height: 600 },
    expected: { zoom: 2, panX: 0, panY: 0 },
  },
];
