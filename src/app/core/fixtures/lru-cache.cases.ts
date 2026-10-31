/**
 * Fixtures: core/lru-cache
 * Requirements: NFR-004, NFR-009, NFR-010
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */

/** Op: ['set', key, bytes] (value = the key string), ['get', key], ['peek', key], ['delete', key], ['clear'], ['budget', bytes].
 *  `results` collects the return values of get/peek/delete in order (get/peek: the key string, or null if missing).
 *  `removed` lists [key, reason] in the order the onRemove callback was called. */
export type LruOp = ['set', string, number] | ['get', string] | ['peek', string] | ['delete', string] | ['clear'] | ['budget', number];

export const lruCases: ReadonlyArray<{
  id: string; req: string; name: string; budget: number; ops: LruOp[];
  expected: { keys: string[]; totalBytes: number; size: number; removed: Array<[string, string]>; results: Array<string | boolean | null> };
}> = [
  {
    id: 'L01',
    req: 'NFR-004',
    name: 'filling beyond the budget evicts the least recently used',
    budget: 100,
    ops: [['set', 'a', 40], ['set', 'b', 40], ['set', 'c', 40]],
    expected: { keys: ['b', 'c'], totalBytes: 80, size: 2, removed: [['a', 'evicted']], results: [] },
  },
  {
    id: 'L02',
    req: 'NFR-004',
    name: 'get refreshes recency',
    budget: 100,
    ops: [['set', 'a', 40], ['set', 'b', 40], ['get', 'a'], ['set', 'c', 40]],
    expected: { keys: ['a', 'c'], totalBytes: 80, size: 2, removed: [['b', 'evicted']], results: ['a'] },
  },
  {
    id: 'L03',
    req: 'NFR-004',
    name: 'peek does not refresh recency',
    budget: 100,
    ops: [['set', 'a', 40], ['set', 'b', 40], ['peek', 'a'], ['set', 'c', 40]],
    expected: { keys: ['b', 'c'], totalBytes: 80, size: 2, removed: [['a', 'evicted']], results: ['a'] },
  },
  {
    id: 'L04',
    req: 'NFR-004',
    name: 'replacing a key reports the old value as replaced',
    budget: 100,
    ops: [['set', 'a', 40], ['set', 'a', 60]],
    expected: { keys: ['a'], totalBytes: 60, size: 1, removed: [['a', 'replaced']], results: [] },
  },
  {
    id: 'L05',
    req: 'NFR-004',
    name: 'an entry larger than the budget is rejected',
    budget: 100,
    ops: [['set', 'big', 150]],
    expected: { keys: [], totalBytes: 0, size: 0, removed: [['big', 'rejected']], results: [] },
  },
  {
    id: 'L06',
    req: 'NFR-010',
    name: 'shrinking the budget evicts oldest first',
    budget: 150,
    ops: [['set', 'a', 40], ['set', 'b', 40], ['set', 'c', 40], ['budget', 70]],
    expected: {
      keys: ['c'],
      totalBytes: 40,
      size: 1,
      removed: [['a', 'evicted'], ['b', 'evicted']],
      results: [],
    },
  },
  {
    id: 'L07',
    req: 'NFR-004',
    name: 'delete reports whether the key existed',
    budget: 100,
    ops: [['set', 'a', 40], ['delete', 'a'], ['delete', 'a']],
    expected: { keys: [], totalBytes: 0, size: 0, removed: [['a', 'deleted']], results: [true, false] },
  },
  {
    id: 'L08',
    req: 'NFR-009',
    name: 'clear removes least recently used first',
    budget: 100,
    ops: [['set', 'a', 40], ['set', 'b', 40], ['get', 'a'], ['clear']],
    expected: {
      keys: [],
      totalBytes: 0,
      size: 0,
      removed: [['b', 'cleared'], ['a', 'cleared']],
      results: ['a'],
    },
  },
  {
    id: 'L09',
    req: 'NFR-004',
    name: 'a replacement that overflows also evicts',
    budget: 100,
    ops: [['set', 'a', 60], ['set', 'b', 30], ['set', 'a', 80]],
    expected: {
      keys: ['a'],
      totalBytes: 80,
      size: 1,
      removed: [['a', 'replaced'], ['b', 'evicted']],
      results: [],
    },
  },
  {
    id: 'L10',
    req: 'NFR-004',
    name: 'exactly at the budget nothing is evicted',
    budget: 100,
    ops: [['set', 'a', 50], ['set', 'b', 50]],
    expected: { keys: ['a', 'b'], totalBytes: 100, size: 2, removed: [], results: [] },
  },
  {
    id: 'L11',
    req: 'NFR-004',
    name: 'get of a missing key returns null (undefined) and changes nothing',
    budget: 100,
    ops: [['set', 'a', 10], ['get', 'zzz']],
    expected: { keys: ['a'], totalBytes: 10, size: 1, removed: [], results: [null] },
  },
];
