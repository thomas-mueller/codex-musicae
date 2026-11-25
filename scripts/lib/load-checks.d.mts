export function pageAtOffset(pages: readonly { top: number; height: number }[], y: number): number;
export function isDisplayed(share: number, minShare: number): boolean;
export interface Invariants {
  cacheBytes: number;
  cacheBudgetBytes: number;
  canvasPixels: readonly number[];
  maxCanvasPixels: number;
  heapMb: number;
  maxHeapMb: number;
  peakPerClass: Readonly<Record<string, number>>;
  maxPerClass: number;
}
export function invariantProblems(values: Invariants): string[];
export const COMPARED_KEYS: readonly string[];
export const SUMMARY_MARKER: string;
export const SUMMARY_HEADER: string;
export function comparedValue(values: Readonly<Record<string, number>>): number | undefined;
export function summaryRow(row: { entry?: string; name: string; values: Readonly<Record<string, number>>; limit?: number }): string;
