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
