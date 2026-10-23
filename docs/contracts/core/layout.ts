/**
 * core/layout — size class of the layout. Requirement: UIX-003.
 */
export type SizeClass = 'compact' | 'expanded';

/** 'compact' if width < compactMaxWidthPx OR height < compactMaxHeightPx, else 'expanded' (limits are exclusive upper bounds). */
export function sizeClassOf(
  _width: number,
  _height: number,
  _limits: { readonly compactMaxWidthPx: number; readonly compactMaxHeightPx: number },
): SizeClass {
  throw new Error('not implemented');
}
