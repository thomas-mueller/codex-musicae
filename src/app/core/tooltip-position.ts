/** core/tooltip-position — where a tooltip goes so that it stays on the screen. Requirement: UIX-027. */

/** A rectangle by its edges, in CSS pixels of the window. */
export interface Edges {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface Size {
  readonly width: number;
  readonly height: number;
}

export type TooltipSide = 'above' | 'below';

/** `value` within [min, max]; a range that is too small (a tooltip larger than the area) gives its start. */
const within = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

/**
 * The top left corner of a tooltip of `size` for the control `anchor`, inside `area` shrunk by `gap` on every side.
 * Horizontally it is centred on the control and pushed inside. Vertically it touches the control on the preferred
 * `side`; if that side has no room it goes to the other one, so the control stays visible; if neither has room it is
 * pushed inside from the preferred side.
 */
export function placeTooltip(anchor: Edges, size: Size, area: Edges, side: TooltipSide, gap: number): { readonly left: number; readonly top: number } {
  const minTop = area.top + gap;
  const maxTop = area.bottom - gap - size.height;
  const tops = { above: anchor.top - size.height, below: anchor.bottom };
  const other: TooltipSide = side === 'above' ? 'below' : 'above';
  const fits = (top: number): boolean => top >= minTop && top <= maxTop;
  const top = fits(tops[side]) ? tops[side] : fits(tops[other]) ? tops[other] : within(tops[side], minTop, maxTop);
  const centred = (anchor.left + anchor.right - size.width) / 2;
  return { left: within(centred, area.left + gap, area.right - gap - size.width), top };
}
