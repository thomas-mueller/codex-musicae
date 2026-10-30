/**
 * core/layout — size class of the layout. Requirement: UIX-003.
 */
export type SizeClass = 'compact' | 'expanded';

/** 'compact' if width < compactMaxWidthPx OR height < compactMaxHeightPx, else 'expanded' (limits are exclusive upper bounds). */
export function sizeClassOf(
  width: number,
  height: number,
  limits: { readonly compactMaxWidthPx: number; readonly compactMaxHeightPx: number },
): SizeClass {
  return width < limits.compactMaxWidthPx || height < limits.compactMaxHeightPx ? 'compact' : 'expanded';
}
