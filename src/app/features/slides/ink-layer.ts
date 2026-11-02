import { TUNABLES } from '../../../config/tunables';
import { fitScaleToPixelCap } from '../../core';
import type { PlacedStroke, Rect } from '../../core';
import { drawPlaced } from './ink-draw';
import type { InkKind } from './ink-draw';

const KINDS: readonly InkKind[] = ['highlighter', 'pen'];
const MULTIPLY = 'multiply';

/**
 * The committed ink of the slide on display: one canvas for the highlighter (blended with the page by CSS multiply) and
 * one for pens, both with the geometry of the slide canvas. While the slide is zoomed, `showSharp` covers the visible
 * part with canvases drawn at the zoomed scale (NFR-002) and hides the stretched ones. Imperative, no signals.
 */
export class InkLayer {
  private placed: readonly PlacedStroke[] = [];
  private hidden: ReadonlySet<string> = new Set();
  private pxPerUnit = 1;
  private sharp: Rect | null = null;
  private sharpGeometry: { slideScale: number; zoomedScale: number; dpr: number } | null = null;

  constructor(
    private readonly base: Readonly<Record<InkKind, HTMLCanvasElement>>,
    private readonly sharpHost: HTMLElement,
  ) {}

  /** Same pixel and CSS size as the slide canvas; resizing also wipes the canvases. */
  resize(widthPx: number, heightPx: number, cssWidth: string, cssHeight: string, pxPerUnit: number): void {
    this.pxPerUnit = pxPerUnit;
    for (const kind of KINDS) {
      const canvas = this.base[kind];
      canvas.width = widthPx;
      canvas.height = heightPx;
      canvas.style.width = cssWidth;
      canvas.style.height = cssHeight;
    }
  }

  /** The strokes to show (slide space) and the ids to leave out while they are being erased. */
  setStrokes(placed: readonly PlacedStroke[], hidden: ReadonlySet<string>): void {
    this.placed = placed;
    this.hidden = hidden;
    this.drawBase();
    if (this.sharp && this.sharpGeometry) {
      this.drawSharp(this.sharp, this.sharpGeometry);
    }
  }

  /** `region` is the visible part of the zoomed slide in slide units; scales are CSS px per slide unit. */
  showSharp(region: Rect, slideScale: number, zoomedScale: number, dpr: number): void {
    this.sharp = region;
    this.sharpGeometry = { slideScale, zoomedScale, dpr };
    this.drawSharp(region, this.sharpGeometry);
    for (const kind of KINDS) {
      this.base[kind].style.visibility = 'hidden';
    }
  }

  hideSharp(): void {
    this.sharp = null;
    this.sharpGeometry = null;
    this.sharpHost.replaceChildren();
    for (const kind of KINDS) {
      this.base[kind].style.visibility = '';
    }
  }

  get sharpShown(): boolean {
    return this.sharp !== null;
  }

  private drawBase(): void {
    for (const kind of KINDS) {
      const canvas = this.base[kind];
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        drawPlaced(context, this.placed, { x: 0, y: 0 }, this.pxPerUnit, kind, this.hidden);
      }
    }
  }

  private drawSharp(region: Rect, geometry: { slideScale: number; zoomedScale: number; dpr: number }): void {
    const pxPerUnit = fitScaleToPixelCap(region.width, region.height, geometry.zoomedScale * geometry.dpr, TUNABLES.resources.maxCanvasPixels);
    const canvases = KINDS.map((kind) => {
      const canvas = this.sharpHost.ownerDocument.createElement('canvas');
      canvas.width = Math.max(1, Math.round(region.width * pxPerUnit));
      canvas.height = Math.max(1, Math.round(region.height * pxPerUnit));
      // Inline styles: elements made here do not get the component's encapsulated stylesheet.
      canvas.style.position = 'absolute';
      canvas.style.pointerEvents = 'none';
      canvas.style.left = `${region.x * geometry.slideScale}px`;
      canvas.style.top = `${region.y * geometry.slideScale}px`;
      canvas.style.width = `${region.width * geometry.slideScale}px`;
      canvas.style.height = `${region.height * geometry.slideScale}px`;
      if (kind === 'highlighter') {
        canvas.style.mixBlendMode = MULTIPLY;
      }
      const context = canvas.getContext('2d');
      if (context) {
        drawPlaced(context, this.placed, { x: region.x, y: region.y }, pxPerUnit, kind, this.hidden);
      }
      return canvas;
    });
    this.sharpHost.replaceChildren(...canvases);
  }
}
