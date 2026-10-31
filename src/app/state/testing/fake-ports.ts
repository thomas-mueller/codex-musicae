import { vi } from 'vitest';

import type { FileAccess, FileRef } from '../../ports/file-access';
import { err } from '../../ports/result';
import type { Preferences } from '../../ports/preferences';

export function memoryPreferences(initial: Record<string, unknown> = {}): Preferences & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    data,
    get: <T>(key: string) => Promise.resolve(data.get(key) as T | undefined),
    set: (key, value) => {
      data.set(key, structuredClone(value));
      return Promise.resolve();
    },
    remove: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
}

/** Files with the same name count as the same file. */
export function fakeFileAccess(): FileAccess & { forget: ReturnType<typeof vi.fn<(ref: FileRef) => Promise<void>>> } {
  return {
    pickPdfs: () => Promise.resolve(err('cancelled')),
    reopen: () => Promise.resolve(err('not-found')),
    write: () => Promise.resolve(err('unsupported')),
    saveCopy: () => Promise.resolve(err('unsupported')),
    isSame: (a, b) => Promise.resolve(a.name === b.name),
    forget: vi.fn(() => Promise.resolve()),
  };
}
