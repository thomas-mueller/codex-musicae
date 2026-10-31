/**
 * core/cache-budget — bitmap cache budget from the device memory. Requirement: NFR-004.
 */

/**
 * Budget for `deviceMemoryGb`: the entry of the nearest lower (or equal) bucket in `byGb`;
 * below the smallest bucket the smallest budget; unknown memory → `defaultBytes`.
 */
export function cacheBudgetFor(
  deviceMemoryGb: number | undefined,
  byGb: Readonly<Record<number, number>>,
  defaultBytes: number,
): number {
  if (deviceMemoryGb === undefined) {
    return defaultBytes;
  }
  const buckets = Object.keys(byGb)
    .map(Number)
    .sort((a, b) => a - b);
  const smallest = buckets[0];
  if (smallest === undefined) {
    return defaultBytes;
  }
  let chosen = smallest;
  for (const bucket of buckets) {
    if (bucket <= deviceMemoryGb) {
      chosen = bucket;
    }
  }
  return byGb[chosen] ?? defaultBytes;
}
