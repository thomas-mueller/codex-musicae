import type { Point } from '../../core';
import type { StrokeStyle } from '../../state/tool-settings.store';

/** Animation-frame source; the spec replaces it with a manual one. */
export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(id: number): void;
}

const BROWSER_FRAMES: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
};

/**
 * The live layer of a stroke being drawn: its own canvas with the geometry of the slide canvas. Imperative on purpose
 * (no signals, no change detection per point, ANN-011): points are queued and each animation frame draws only the new
 * segments. The highlighter is drawn opaque and the canvas gets the CSS opacity and multiply blending, so the live look
 * equals the committed look. Points are in slide space.
 */
export class LiveStrokeRenderer {
  private pxPerUnit = 1;
  private pending: Point[] = [];
  private last: Point | null = null;
  private frame: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly frames: FrameScheduler = BROWSER_FRAMES,
  ) {}

  /** Same pixel and CSS size as the slide canvas; resizing also wipes the layer. */
  resize(widthPx: number, heightPx: number, cssWidth: string, cssHeight: string, pxPerUnit: number): void {
    this.cancelFrame();
    this.pending = [];
    this.last = null;
    this.pxPerUnit = pxPerUnit;
    this.canvas.width = widthPx;
    this.canvas.height = heightPx;
    this.canvas.style.width = cssWidth;
    this.canvas.style.height = cssHeight;
  }

  begin(style: StrokeStyle): void {
    this.clear();
    this.canvas.style.opacity = String(style.opacity);
    this.canvas.style.mixBlendMode = style.multiply ? 'multiply' : 'normal';
    const context = this.canvas.getContext('2d');
    if (context) {
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = style.color;
      context.lineWidth = style.widthPt * this.pxPerUnit;
    }
  }

  add(points: readonly Point[]): void {
    if (points.length === 0) {
      return;
    }
    this.pending.push(...points);
    this.frame ??= this.frames.request(() => this.draw());
  }

  clear(): void {
    this.cancelFrame();
    this.pending = [];
    this.last = null;
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.style.opacity = '';
    this.canvas.style.mixBlendMode = '';
  }

  /** Only the segments since the previous frame; a single point is a dot (zero-length segment with round caps). */
  private draw(): void {
    this.frame = null;
    const points = this.pending;
    this.pending = [];
    const first = points[0];
    const context = this.canvas.getContext('2d');
    if (first === undefined || !context) {
      return;
    }
    const from = this.last ?? first;
    context.beginPath();
    context.moveTo(from.x * this.pxPerUnit, from.y * this.pxPerUnit);
    for (const point of points) {
      context.lineTo(point.x * this.pxPerUnit, point.y * this.pxPerUnit);
    }
    context.stroke();
    this.last = points[points.length - 1] ?? from;
  }

  private cancelFrame(): void {
    if (this.frame !== null) {
      this.frames.cancel(this.frame);
      this.frame = null;
    }
  }
}
