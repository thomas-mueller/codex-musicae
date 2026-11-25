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

/** The keys of a report whose value is held against the limit, in the order they are looked for (V2-M3b S4, TST-026). */
export const COMPARED_KEYS = ['p95', 'added', 'longest', 'elapsed', 'heapMb'];
/** First line of the job summary table; the file is checked for it so that the header is written once. */
export const SUMMARY_MARKER = '## Performance and load measurements';
export const SUMMARY_HEADER = `${SUMMARY_MARKER}\n\n| Entry | Scenario | Value | Limit | Result |\n|---|---|---|---|---|\n`;
const DECIMALS = 1;
const NONE = '–';

/** The value of a report that the limit applies to, or `undefined` when the report has none of the compared keys. */
export function comparedValue(values) {
  const key = COMPARED_KEYS.find((candidate) => values[candidate] !== undefined);
  return key === undefined ? undefined : values[key];
}

/**
 * One row of the job summary table: entry, scenario, the values, the limit (with the CI tolerance already applied by the caller) and the result:
 * `ok`, `breach` (compared value above the limit) or `–` (no limit, or nothing to compare). A trailing ` <entry>` of the scenario name is dropped.
 */
export function summaryRow({ entry, name, values, limit }) {
  const scenario = entry !== undefined && name.endsWith(` ${entry}`) ? name.slice(0, -entry.length - 1) : name;
  const text = Object.entries(values)
    .map(([key, value]) => `${key}=${value.toFixed(DECIMALS)}`)
    .join(' ');
  const compared = comparedValue(values);
  const result = limit === undefined || compared === undefined ? NONE : compared > limit ? 'breach' : 'ok';
  return `| ${entry ?? NONE} | ${scenario} | ${text} | ${limit === undefined ? NONE : limit.toFixed(DECIMALS)} | ${result} |\n`;
}
