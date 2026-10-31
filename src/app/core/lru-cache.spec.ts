import { describe, expect, it } from 'vitest';

import { LruByteCache } from './lru-cache';
import { lruCases } from './fixtures/lru-cache.cases';
import { caseTitle } from '../../testing/expect-close-deep';

describe('LruByteCache', () => {
  for (const c of lruCases) {
    it(caseTitle(c, 'NFR-004'), () => {
      const removed: Array<[string, string]> = [];
      const results: Array<string | boolean | null> = [];
      const cache = new LruByteCache<string>(c.budget, (key, _value, reason) => removed.push([key, reason]));
      for (const op of c.ops) {
        switch (op[0]) {
          case 'set':
            cache.set(op[1], op[1], op[2]);
            break;
          case 'get':
            results.push(cache.get(op[1]) ?? null);
            break;
          case 'peek':
            results.push(cache.peek(op[1]) ?? null);
            break;
          case 'delete':
            results.push(cache.delete(op[1]));
            break;
          case 'clear':
            cache.clear();
            break;
          case 'budget':
            cache.setBudget(op[1]);
            break;
        }
      }
      expect(cache.keys()).toEqual(c.expected.keys);
      expect(cache.totalBytes).toBe(c.expected.totalBytes);
      expect(cache.size).toBe(c.expected.size);
      expect(removed).toEqual(c.expected.removed);
      expect(results).toEqual(c.expected.results);
    });
  }
});
