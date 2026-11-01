import { TUNABLES } from '../../../config/tunables';
import type { SlideComposition } from '../../core';

/** The part of CanvasRenderingContext2D that drawing a slide uses; a recording fake implements it in tests. */
export interface SlideContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  globalAlpha: number;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: ImageBitmap, dx: number, dy: number, dWidth: number, dHeight: number): void;
}

/**
 * SLD-007..SLD-009: paints a composed slide. `bitmaps[i]` belongs to `composition.contents[i]`; a missing one leaves the
 * canvas grey there. Bitmaps are owned by the cache and are never closed here.
 */
export function drawComposition(
  context: SlideContext,
  composition: SlideComposition,
  bitmaps: ReadonlyArray<ImageBitmap | null | undefined>,
  pxPerUnit: number,
): void {
  context.fillStyle = TUNABLES.colors.canvasGrey;
  context.fillRect(0, 0, composition.width * pxPerUnit, composition.height * pxPerUnit);
  composition.contents.forEach((content, i) => {
    const bitmap = bitmaps[i];
    if (bitmap) {
      const { dest } = content;
      context.drawImage(bitmap, dest.x * pxPerUnit, dest.y * pxPerUnit, dest.width * pxPerUnit, dest.height * pxPerUnit);
    }
  });
  for (const overlay of composition.overlays) {
    context.globalAlpha = TUNABLES.colors.overlayOpacity;
    context.fillStyle = TUNABLES.colors.canvasGrey;
    context.fillRect(0, overlay.y * pxPerUnit, overlay.width * pxPerUnit, overlay.height * pxPerUnit);
    context.globalAlpha = 1;
  }
}
