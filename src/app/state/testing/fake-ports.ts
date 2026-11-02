import { vi } from 'vitest';

import type { FileAccess, FileAccessError, FileRef } from '../../ports/file-access';
import type { PdfEdits, PdfWriteError, PdfWriter } from '../../ports/pdf-writer';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
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
export type FakeFileAccess = FileAccess & {
  forget: ReturnType<typeof vi.fn<(ref: FileRef) => Promise<void>>>;
  write: ReturnType<typeof vi.fn<(ref: FileRef, bytes: Uint8Array) => Promise<Result<void, FileAccessError>>>>;
  saveCopy: ReturnType<typeof vi.fn<(name: string, bytes: Uint8Array) => Promise<Result<void, FileAccessError>>>>;
};

/** `write` and `saveCopy` succeed by default; specs override them with `mockImplementation`. */
export function fakeFileAccess(): FakeFileAccess {
  return {
    pickPdfs: () => Promise.resolve(err('cancelled')),
    reopen: () => Promise.resolve(err('not-found')),
    write: vi.fn(() => Promise.resolve(ok(undefined))),
    saveCopy: vi.fn(() => Promise.resolve(ok(undefined))),
    isSame: (a, b) => Promise.resolve(a.name === b.name),
    forget: vi.fn(() => Promise.resolve()),
  };
}

export type FakePdfWriter = PdfWriter & {
  apply: ReturnType<typeof vi.fn<(bytes: Uint8Array, edits: PdfEdits, signal: AbortSignal) => Promise<Result<Uint8Array, PdfWriteError>>>>;
};

/** `apply` answers new bytes (the input plus one byte per call) and records its edits. */
export function fakePdfWriter(): FakePdfWriter {
  return {
    readEmbeddedJson: () => Promise.resolve(ok(null)),
    listInk: () => Promise.resolve(ok([])),
    apply: vi.fn((bytes: Uint8Array) => Promise.resolve(ok(new Uint8Array([...bytes, 1])))),
  };
}
