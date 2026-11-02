/** UIX-020: position of slide `index` of `count` as a fraction; null (no line) without slides. */
export function presentationProgress(index: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  return count > 1 ? Math.min(Math.max(index / (count - 1), 0), 1) : 1;
}
