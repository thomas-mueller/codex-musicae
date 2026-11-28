/**
 * core/layout — size class and width of the layout. Requirements: UIX-003, UIX-037.
 */
type SizeClass = 'compact' | 'expanded';

/** 'compact' if width < compactMaxWidthPx OR height < compactMaxHeightPx, else 'expanded' (limits are exclusive upper bounds). */
export function sizeClassOf(
  width: number,
  height: number,
  limits: { readonly compactMaxWidthPx: number; readonly compactMaxHeightPx: number },
): SizeClass {
  return width < limits.compactMaxWidthPx || height < limits.compactMaxHeightPx ? 'compact' : 'expanded';
}

/** UIX-037: too narrow for three mode buttons. A width of 0 means not measured yet and is not narrow. */
export function isNarrow(width: number, limits: { readonly compactMaxWidthPx: number }): boolean {
  return width > 0 && width < limits.compactMaxWidthPx;
}
