/**
 * core/lru-cache — byte-budget LRU cache (pure data structure). Requirements: NFR-004, NFR-009, NFR-010.
 * The owner of the values (for example ImageBitmaps) frees them in `onRemove`.
 */

export type RemoveReason = 'evicted' | 'replaced' | 'deleted' | 'cleared' | 'rejected';

export class LruByteCache<V> {
  /**
   * @param budgetBytes maximum total size of stored entries
   * @param onRemove    called once for EVERY value that leaves the cache (so the owner can free it), in the order it leaves
   */
  constructor(
    _budgetBytes: number,
    _onRemove?: (key: string, value: V, reason: RemoveReason) => void,
  ) {}

  /** Sum of the sizes of all stored entries. */
  get totalBytes(): number {
    throw new Error('not implemented');
  }

  /** Number of stored entries. */
  get size(): number {
    throw new Error('not implemented');
  }

  /** Returns the value and marks the entry as most recently used. */
  get(_key: string): V | undefined {
    throw new Error('not implemented');
  }

  /** Returns the value without changing the recency order. */
  peek(_key: string): V | undefined {
    throw new Error('not implemented');
  }

  /**
   * Stores `value` as most recently used.
   * - Existing key: the old value leaves with reason 'replaced' (also when it is the same object).
   * - bytes > budget: the value is not stored and leaves at once with reason 'rejected'.
   * - Then least recently used entries leave with reason 'evicted' until totalBytes <= budget.
   */
  set(_key: string, _value: V, _bytes: number): void {
    throw new Error('not implemented');
  }

  /** Removes an entry (reason 'deleted'). Returns whether it existed. */
  delete(_key: string): boolean {
    throw new Error('not implemented');
  }

  /** Removes all entries, least recently used first (reason 'cleared'). */
  clear(): void {
    throw new Error('not implemented');
  }

  /** Changes the budget and evicts (reason 'evicted') least recently used entries until totalBytes <= budget. */
  setBudget(_budgetBytes: number): void {
    throw new Error('not implemented');
  }

  /** Keys from least to most recently used. */
  keys(): string[] {
    throw new Error('not implemented');
  }
}
