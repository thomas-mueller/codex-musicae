/**
 * core/client-to-slide — pointer position on screen -> slide space. Requirements: ANN-008, ANN-009.
 * The slide is shown centered in the stage, scaled by `displayScale * zoom` and shifted by the pan.
 */
import type { Point, Rect, Size } from './geometry';
import type { ViewState } from './view';

/**
 * slide = slideCenter + (client - stageCenter - pan) / (zoom * displayScale), where `stageRect` is the stage in client
 * coordinates and `stageCenter` its center.
 */
export function clientToSlide(client: Point, stageRect: Rect, view: ViewState, displayScale: number, slideSize: Size): Point {
  const scale = view.zoom * displayScale;
  const centerX = stageRect.x + stageRect.width / 2;
  const centerY = stageRect.y + stageRect.height / 2;
  return {
    x: slideSize.width / 2 + (client.x - centerX - view.panX) / scale,
    y: slideSize.height / 2 + (client.y - centerY - view.panY) / scale,
  };
}
