/**
 * core/prefetch-budget — how many neighbors per side may be prefetched without evicting the displayed slide. Requirement: NFR-027.
 */

/** Bytes the bitmap cache counts for one pixel of a bitmap (RGBA). */
export const BITMAP_BYTES_PER_PIXEL = 4;

/**
 * The largest number of neighbors per side, 0 … `wanted`, for which the current slide and its neighbors
 * (`1 + 2n` slides of `slideBytes`) fit into `share` of `budgetBytes`. A slide of unknown size (`slideBytes <= 0`) does not limit.
 */
export function prefetchCountFor(slideBytes: number, budgetBytes: number, wanted: number, share: number): number {
  if (!(wanted > 0) || !Number.isFinite(wanted)) {
    return 0;
  }
  if (slideBytes <= 0) {
    return Math.floor(wanted);
  }
  const room = budgetBytes * share;
  if (!Number.isFinite(slideBytes) || !Number.isFinite(room) || room < slideBytes) {
    return 0;
  }
  const neighborsPerSide = Math.floor((room / slideBytes - 1) / 2);
  return Math.max(0, Math.min(Math.floor(wanted), neighborsPerSide));
}
