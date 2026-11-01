import type { Point, Rect } from '../../core';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * ORG-014: top-left of the selection chip in content coordinates. Right-aligned to the bar's right edge, below the bar;
 * flips above the bar when it would leave the viewport at the bottom, and is clamped into the viewport.
 */
export function chipPlacement(bar: Rect, chip: Size, viewport: Rect, gap: number): Point {
  const maxX = viewport.x + viewport.width - chip.width;
  const x = Math.max(viewport.x, Math.min(bar.x + bar.width - chip.width - gap, maxX));
  const below = bar.y + bar.height + gap;
  const above = bar.y - gap - chip.height;
  const fitsBelow = below + chip.height <= viewport.y + viewport.height;
  const preferred = fitsBelow || above < viewport.y ? below : above;
  const maxY = viewport.y + viewport.height - chip.height;
  return { x, y: Math.max(viewport.y, Math.min(preferred, maxY)) };
}
