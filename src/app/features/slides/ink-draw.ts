import type { PlacedStroke, Point } from '../../core';

/** The part of CanvasRenderingContext2D that drawing ink uses; a recording fake implements it in tests. */
export interface InkContext {
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  globalCompositeOperation: GlobalCompositeOperation;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  stroke(): void;
}

/** Highlighter strokes live on their own canvas, which the page blends with CSS multiply; pens on a normal one. */
export type InkKind = 'pen' | 'highlighter';

/**
 * ANN-012: draws the strokes of one kind. `origin` is the slide point at the top-left of the canvas (the sharp canvases
 * cover only the visible part of the zoomed slide). Lines are smoothed with quadratic curves through the midpoints; a
 * stroke of two equal points is a dot (round caps). The highlighter uses its opacity and `multiply` between strokes.
 */
export function drawPlaced(
  context: InkContext,
  placed: readonly PlacedStroke[],
  origin: Point,
  pxPerUnit: number,
  kind: InkKind,
  hidden: ReadonlySet<string>,
): void {
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const { stroke, points } of placed) {
    if (stroke.multiply !== (kind === 'highlighter') || hidden.has(stroke.id)) {
      continue;
    }
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.widthPt * pxPerUnit;
    context.globalAlpha = stroke.opacity;
    context.globalCompositeOperation = stroke.multiply ? 'multiply' : 'source-over';
    trace(context, points.map((p) => ({ x: (p.x - origin.x) * pxPerUnit, y: (p.y - origin.y) * pxPerUnit })));
    context.stroke();
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
}

function trace(context: InkContext, points: readonly Point[]): void {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return;
  }
  context.beginPath();
  context.moveTo(first.x, first.y);
  if (points.length <= 2) {
    context.lineTo(last.x, last.y);
    return;
  }
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i] as Point;
    const next = points[i + 1] as Point;
    context.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  context.lineTo(last.x, last.y);
}
