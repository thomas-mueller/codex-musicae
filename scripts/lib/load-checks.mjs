// Pure checks of the load suite (V2-M3b S3, TST-025). The e2e run reads the numbers; these functions decide. All limits are handed in.

/** The index of the page `{ top, height }` that contains the vertical offset `y` (a page spans [top, top + height)), or -1. */
export function pageAtOffset(pages, y) {
  return pages.findIndex((page) => y >= page.top && y < page.top + page.height);
}

/** Whether a share of the visible page area that shows drawn tiles counts as "the page is displayed". */
export function isDisplayed(share, minShare) {
  return share >= minShare;
}

/**
 * The invariants of the resource use (T:resources, T:budgets) as a list of problems; empty means they hold.
 * `canvasPixels` is the pixel count of every canvas seen, `peakPerClass` the most tasks that ran at once per scheduler class.
 */
export function invariantProblems({ cacheBytes, cacheBudgetBytes, canvasPixels, maxCanvasPixels, heapMb, maxHeapMb, peakPerClass, maxPerClass }) {
  const problems = [];
  if (cacheBytes > cacheBudgetBytes) problems.push(`bitmap cache ${cacheBytes} bytes above its budget of ${cacheBudgetBytes}`);
  const biggest = Math.max(0, ...canvasPixels);
  if (biggest > maxCanvasPixels) problems.push(`a canvas of ${biggest} pixels is above the cap of ${maxCanvasPixels}`);
  if (heapMb > maxHeapMb) problems.push(`JS heap ${heapMb.toFixed(1)} MiB above the limit of ${maxHeapMb} MiB`);
  for (const [cls, peak] of Object.entries(peakPerClass)) {
    if (peak > maxPerClass) problems.push(`${peak} tasks of class ${cls} ran at once (at most ${maxPerClass})`);
  }
  return problems;
}
