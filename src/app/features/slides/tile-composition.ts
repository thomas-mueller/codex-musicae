import type { Rect, SlideComposition, SlideContent } from '../../core';

const EPSILON = 1e-9;

function intersection(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  return x1 - x0 > EPSILON && y1 - y0 > EPSILON ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

/**
 * SLD-018, NFR-007: the part of a composition inside `tile` (slide units), as a composition of its own whose origin is
 * the tile's top-left corner. Pieces keep their scale: source and dest shrink by the same clip, so `drawComposition`
 * paints a tile exactly as the full slide would be painted there.
 */
export function tileComposition(composition: SlideComposition, tile: Rect): SlideComposition {
  const contents: SlideContent[] = [];
  for (const content of composition.contents) {
    const clip = intersection(content.dest, tile);
    if (clip) {
      contents.push({
        ...content,
        source: {
          x: content.source.x + (clip.x - content.dest.x),
          y: content.source.y + (clip.y - content.dest.y),
          width: clip.width,
          height: clip.height,
        },
        dest: { x: clip.x - tile.x, y: clip.y - tile.y, width: clip.width, height: clip.height },
      });
    }
  }
  const overlays: Rect[] = [];
  for (const overlay of composition.overlays) {
    const clip = intersection(overlay, tile);
    if (clip) {
      overlays.push({ x: clip.x - tile.x, y: clip.y - tile.y, width: clip.width, height: clip.height });
    }
  }
  return { width: tile.width, height: tile.height, stackTop: composition.stackTop - tile.y, contents, overlays };
}
