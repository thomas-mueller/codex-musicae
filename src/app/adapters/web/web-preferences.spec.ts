import { describe, expect, it } from 'vitest';

import { TUNABLES } from '../../../config/tunables';
import { WebPreferences } from './web-preferences';
import type { PreferencesStorage } from './web-preferences';

function memoryStorage(): PreferencesStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwingStorage: PreferencesStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('quota');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

describe('WebPreferences', () => {
  it('FIL-015 stores JSON under the key prefix', async () => {
    const storage = memoryStorage();
    await new WebPreferences(storage).set('recent', [{ id: 'a' }]);
    expect(storage.data.get(`${TUNABLES.persistence.keyPrefix}recent`)).toBe('[{"id":"a"}]');
  });

  it('FIL-015 round-trips values', async () => {
    const prefs = new WebPreferences(memoryStorage());
    await prefs.set('x', { n: 1, list: ['a'] });
    expect(await prefs.get('x')).toEqual({ n: 1, list: ['a'] });
  });

  it('FIL-015 returns undefined for a missing key', async () => {
    expect(await new WebPreferences(memoryStorage()).get('nope')).toBeUndefined();
  });

  it('FIL-015 returns undefined for corrupt JSON', async () => {
    const storage = memoryStorage();
    storage.data.set(`${TUNABLES.persistence.keyPrefix}bad`, '{not json');
    expect(await new WebPreferences(storage).get('bad')).toBeUndefined();
  });

  it('FIL-015 remove deletes the entry', async () => {
    const prefs = new WebPreferences(memoryStorage());
    await prefs.set('x', 1);
    await prefs.remove('x');
    expect(await prefs.get('x')).toBeUndefined();
  });

  it('FIL-015 swallows storage errors', async () => {
    const prefs = new WebPreferences(throwingStorage);
    await expect(prefs.set('x', 1)).resolves.toBeUndefined();
    await expect(prefs.remove('x')).resolves.toBeUndefined();
    expect(await prefs.get('x')).toBeUndefined();
  });

  it('FIL-015 ignores values that cannot be serialized', async () => {
    const storage = memoryStorage();
    await new WebPreferences(storage).set('x', undefined);
    expect(storage.data.size).toBe(0);
  });
});
