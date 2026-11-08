import { signal } from '@angular/core';
import { vi } from 'vitest';

import type { FileAccess, FileAccessError, FileRef } from '../../ports/file-access';
import type { ExistingInk, PdfEdits, PdfWriteError, PdfWriter } from '../../ports/pdf-writer';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { Fullscreen, FullscreenError } from '../../ports/fullscreen';
import type { WakeLock, WakeLockError } from '../../ports/wake-lock';
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
  requestWriteAccess: ReturnType<typeof vi.fn<(ref: FileRef) => Promise<Result<void, FileAccessError>>>>;
};

/** `write` and `saveCopy` succeed by default; specs override them with `mockImplementation`. */
export function fakeFileAccess(): FakeFileAccess {
  return {
    pickPdfs: () => Promise.resolve(err('cancelled')),
    reopen: () => Promise.resolve(err('not-found')),
    write: vi.fn(() => Promise.resolve(ok(undefined))),
    saveCopy: vi.fn(() => Promise.resolve(ok(undefined))),
    requestWriteAccess: vi.fn(() => Promise.resolve(ok(undefined))),
    isSame: (a, b) => Promise.resolve(a.name === b.name),
    forget: vi.fn(() => Promise.resolve()),
  };
}

export type FakePdfWriter = PdfWriter & {
  readEmbeddedJson: ReturnType<typeof vi.fn<(bytes: Uint8Array) => Promise<Result<string | null, PdfWriteError>>>>;
  listInk: ReturnType<typeof vi.fn<(bytes: Uint8Array) => Promise<Result<readonly ExistingInk[], PdfWriteError>>>>;
  apply: ReturnType<typeof vi.fn<(bytes: Uint8Array, edits: PdfEdits, signal: AbortSignal) => Promise<Result<Uint8Array, PdfWriteError>>>>;
};

/** `apply` answers new bytes (the input plus one byte per call) and records its edits. */
export function fakePdfWriter(): FakePdfWriter {
  return {
    readEmbeddedJson: vi.fn(() => Promise.resolve(ok(null))),
    listInk: vi.fn(() => Promise.resolve(ok([]))),
    apply: vi.fn((bytes: Uint8Array) => Promise.resolve(ok(new Uint8Array([...bytes, 1])))),
  };
}

export type FakeFullscreen = Fullscreen & {
  enterCalls: number;
  exitCalls: number;
  /** Simulates Esc or a system gesture. */
  externalExit(): void;
};

/** `results`: one result for every call, or a list answered in order (the last one repeats). */
export function fakeFullscreen(results: Result<void, FullscreenError> | Result<void, FullscreenError>[] = ok(undefined)): FakeFullscreen {
  const queue = Array.isArray(results) ? [...results] : [results];
  const active = signal(false);
  const callbacks = new Set<() => void>();
  const fake: FakeFullscreen = {
    active: active.asReadonly(),
    enterCalls: 0,
    exitCalls: 0,
    enter: () => {
      fake.enterCalls++;
      const result = queue.length > 1 ? queue.shift()! : queue[0]!;
      active.set(result.ok);
      return Promise.resolve(result);
    },
    exit: () => {
      fake.exitCalls++;
      active.set(false);
      return Promise.resolve();
    },
    onExternalExit: (callback) => {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    externalExit: () => {
      active.set(false);
      for (const callback of callbacks) callback();
    },
  };
  return fake;
}

export type FakeWakeLock = WakeLock & { acquireCalls: number; releaseCalls: number };

export function fakeWakeLock(result: Result<void, WakeLockError> = ok(undefined)): FakeWakeLock {
  const fake: FakeWakeLock = {
    acquireCalls: 0,
    releaseCalls: 0,
    acquire: () => {
      fake.acquireCalls++;
      return Promise.resolve(result);
    },
    release: () => {
      fake.releaseCalls++;
      return Promise.resolve();
    },
  };
  return fake;
}
