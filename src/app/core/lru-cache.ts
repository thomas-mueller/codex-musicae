/**
 * core/lru-cache — byte-budget LRU cache (pure data structure). Requirements: NFR-004, NFR-009, NFR-010.
 * The owner of the values (for example ImageBitmaps) frees them in `onRemove`.
 */

export type RemoveReason = 'evicted' | 'replaced' | 'deleted' | 'cleared' | 'rejected';

interface Entry<V> {
  readonly value: V;
  readonly bytes: number;
}

export class LruByteCache<V> {
  /** Insertion order is the recency order: first = least recently used. */
  private readonly entries = new Map<string, Entry<V>>();
  private bytesStored = 0;

  /**
   * @param budgetBytes maximum total size of stored entries
   * @param onRemove    called once for EVERY value that leaves the cache (so the owner can free it), in the order it leaves
   */
  constructor(
    private budgetBytes: number,
    private readonly onRemove?: (key: string, value: V, reason: RemoveReason) => void,
  ) {}

  /** Sum of the sizes of all stored entries. */
  get totalBytes(): number {
    return this.bytesStored;
  }

  /** Number of stored entries. */
  get size(): number {
    return this.entries.size;
  }

  /** Returns the value and marks the entry as most recently used. */
  get(key: string): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  /** Returns the value without changing the recency order. */
  peek(key: string): V | undefined {
    return this.entries.get(key)?.value;
  }

  /**
   * Stores `value` as most recently used.
   * - Existing key: the old value leaves with reason 'replaced' (also when it is the same object).
   * - bytes > budget: the value is not stored and leaves at once with reason 'rejected'.
   * - Then least recently used entries leave with reason 'evicted' until totalBytes <= budget.
   */
  set(key: string, value: V, bytes: number): void {
    this.remove(key, 'replaced');
    if (bytes > this.budgetBytes) {
      this.onRemove?.(key, value, 'rejected');
      return;
    }
    this.entries.set(key, { value, bytes });
    this.bytesStored += bytes;
    this.evictToBudget();
  }

  /** Removes an entry (reason 'deleted'). Returns whether it existed. */
  delete(key: string): boolean {
    return this.remove(key, 'deleted');
  }

  /** Removes all entries, least recently used first (reason 'cleared'). */
  clear(): void {
    for (const key of [...this.entries.keys()]) {
      this.remove(key, 'cleared');
    }
  }

  /** Changes the budget and evicts (reason 'evicted') least recently used entries until totalBytes <= budget. */
  setBudget(budgetBytes: number): void {
    this.budgetBytes = budgetBytes;
    this.evictToBudget();
  }

  /** Keys from least to most recently used. */
  keys(): string[] {
    return [...this.entries.keys()];
  }

  /** Updates the state first, then notifies, so the callback sees a consistent cache. */
  private remove(key: string, reason: RemoveReason): boolean {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }
    this.entries.delete(key);
    this.bytesStored -= entry.bytes;
    this.onRemove?.(key, entry.value, reason);
    return true;
  }

  private evictToBudget(): void {
    while (this.bytesStored > this.budgetBytes) {
      const oldest = this.entries.keys().next();
      if (oldest.done) {
        return;
      }
      this.remove(oldest.value, 'evicted');
    }
  }
}
