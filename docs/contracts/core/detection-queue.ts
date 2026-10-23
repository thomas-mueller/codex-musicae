/**
 * core/detection-queue — which page detection works on next, and which pages are usable. Requirements: DET-016, DET-019, DET-021.
 * Pages are 0-based; `states[i]` is the state of page i.
 */

export type PageState = 'pending' | 'running' | 'done' | 'failed';

/**
 * Number of pages at the start of the document that are all 'done' or 'failed' (the usable prefix).
 * Junction numbering, slides and interactive bars use only pages inside the prefix.
 */
export function usablePrefix(_states: readonly PageState[]): number {
  throw new Error('not implemented');
}

/** True when no page is 'pending' or 'running'. */
export function isComplete(_states: readonly PageState[]): boolean {
  throw new Error('not implemented');
}

/**
 * The page to start next: `priorityPage` if it is in range and 'pending'; otherwise the lowest index that is 'pending';
 * otherwise null. 'running' pages are never returned.
 */
export function nextPageToProcess(_states: readonly PageState[], _priorityPage: number | null): number | null {
  throw new Error('not implemented');
}

/** DET-021: a page is provisional when it is 'done' but lies outside the usable prefix. */
export function isProvisional(_pageIndex: number, _states: readonly PageState[]): boolean {
  throw new Error('not implemented');
}
