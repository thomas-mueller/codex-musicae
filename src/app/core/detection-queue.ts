/**
 * core/detection-queue — which page detection works on next, and which pages are usable. Requirements: DET-016, DET-019, DET-021.
 * Pages are 0-based; `states[i]` is the state of page i.
 */

export type PageState = 'pending' | 'running' | 'done' | 'failed';

/**
 * Number of pages at the start of the document that are all 'done' or 'failed' (the usable prefix).
 * Junction numbering, slides and interactive bars use only pages inside the prefix.
 */
export function usablePrefix(states: readonly PageState[]): number {
  let n = 0;
  while (n < states.length && (states[n] === 'done' || states[n] === 'failed')) n++;
  return n;
}

/** True when no page is 'pending' or 'running'. */
export function isComplete(states: readonly PageState[]): boolean {
  return !states.some((s) => s === 'pending' || s === 'running');
}

/**
 * The page to start next: `priorityPage` if it is in range and 'pending'; otherwise the lowest index that is 'pending';
 * otherwise null. 'running' pages are never returned.
 */
export function nextPageToProcess(states: readonly PageState[], priorityPage: number | null): number | null {
  if (priorityPage !== null && states[priorityPage] === 'pending') return priorityPage;
  const lowest = states.indexOf('pending');
  return lowest === -1 ? null : lowest;
}

/** DET-021: a page is provisional when it is 'done' but lies outside the usable prefix. */
export function isProvisional(pageIndex: number, states: readonly PageState[]): boolean {
  return states[pageIndex] === 'done' && pageIndex >= usablePrefix(states);
}
