import { describe, expect, it, vi } from 'vitest';

import { WebFileAccess } from './web-file-access';
import type { FsFileHandle, HandleStore, OpenFilePicker } from './web-file-access';
import type { FileRef } from '../../ports/file-access';

class NamedError extends Error {
  constructor(name: string) {
    super(name);
    this.name = name;
  }
}

type MemoryStore = HandleStore & { data: Map<string, FsFileHandle> };

function memoryStore(): MemoryStore {
  const data = new Map<string, FsFileHandle>();
  return {
    data,
    get: (id) => Promise.resolve(data.get(id)),
    put: (id, handle) => {
      data.set(id, handle);
      return Promise.resolve();
    },
    delete: (id) => {
      data.delete(id);
      return Promise.resolve();
    },
  };
}

function pdfFile(name: string, content = [1, 2, 3], lastModified = 1000): File {
  return new File([new Uint8Array(content)], name, { type: 'application/pdf', lastModified });
}

interface HandleOptions {
  file?: File;
  query?: PermissionState;
  request?: PermissionState;
  getFileError?: Error;
  same?: boolean;
}

function fakeHandle(options: HandleOptions = {}): FsFileHandle {
  const file = options.file ?? pdfFile('a.pdf');
  return {
    name: file.name,
    getFile: () => (options.getFileError ? Promise.reject(options.getFileError) : Promise.resolve(file)),
    isSameEntry: () => Promise.resolve(options.same ?? false),
    queryPermission: () => Promise.resolve(options.query ?? 'granted'),
    requestPermission: () => Promise.resolve(options.request ?? 'granted'),
  };
}

function makeAccess(overrides: {
  store?: HandleStore;
  picker?: OpenFilePicker | undefined;
  input?: () => Promise<File[]>;
  activation?: boolean;
} = {}) {
  const store = (overrides.store ?? memoryStore()) as MemoryStore;
  let counter = 0;
  const access = new WebFileAccess({
    handleStore: store,
    newId: () => `id-${++counter}`,
    getPicker: () => overrides.picker,
    pickViaInput: overrides.input ?? (() => Promise.resolve([])),
    hasUserActivation: () => overrides.activation ?? true,
  });
  return { access, store };
}

describe('WebFileAccess.pickPdfs', () => {
  it('FIL-001 opens several PDFs through the file picker and stores their handles', async () => {
    const handles = [fakeHandle({ file: pdfFile('a.pdf') }), fakeHandle({ file: pdfFile('b.pdf', [9]) })];
    const picker = vi.fn(() => Promise.resolve(handles));
    const { access, store } = makeAccess({ picker });
    const result = await access.pickPdfs();
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ multiple: true }));
    if (!result.ok) {
      throw new Error('pick failed');
    }
    expect(result.value.map((f) => f.ref.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(result.value.map((f) => f.ref.id)).toEqual(['id-1', 'id-2']);
    expect(result.value.every((f) => f.writable)).toBe(true);
    expect([...(result.value[1]?.bytes ?? [])]).toEqual([9]);
    expect([...store.data.keys()]).toEqual(['id-1', 'id-2']);
  });

  it('FIL-015 keeps bytes out of the file reference', async () => {
    const { access } = makeAccess({ picker: () => Promise.resolve([fakeHandle()]) });
    const result = await access.pickPdfs();
    if (!result.ok) {
      throw new Error('pick failed');
    }
    expect(Object.keys(result.value[0]?.ref ?? {}).sort()).toEqual(['id', 'lastModified', 'name', 'size']);
    expect(JSON.stringify(result.value[0]?.ref)).not.toContain('bytes');
  });

  it('FIL-001 maps a dismissed picker to cancelled', async () => {
    const { access } = makeAccess({ picker: () => Promise.reject(new NamedError('AbortError')) });
    expect(await access.pickPdfs()).toMatchObject({ ok: false, error: 'cancelled' });
  });

  it('FIL-001 maps a refused picker to denied', async () => {
    const { access } = makeAccess({ picker: () => Promise.reject(new NamedError('SecurityError')) });
    expect(await access.pickPdfs()).toMatchObject({ ok: false, error: 'denied' });
  });

  it('FIL-001 falls back to the file input without storing handles', async () => {
    const input = vi.fn(() => Promise.resolve([pdfFile('c.pdf'), pdfFile('d.pdf')]));
    const { access, store } = makeAccess({ picker: undefined, input });
    const result = await access.pickPdfs();
    if (!result.ok) {
      throw new Error('pick failed');
    }
    expect(result.value.map((f) => f.ref.name)).toEqual(['c.pdf', 'd.pdf']);
    expect(result.value.every((f) => !f.writable)).toBe(true);
    expect(store.data.size).toBe(0);
  });

  it('FIL-001 treats an empty input selection as cancelled', async () => {
    const { access } = makeAccess({ picker: undefined, input: () => Promise.resolve([]) });
    expect(await access.pickPdfs()).toMatchObject({ ok: false, error: 'cancelled' });
  });
});

describe('WebFileAccess.reopen', () => {
  async function reopenWith(handle: FsFileHandle | undefined, activation = true) {
    const { access, store } = makeAccess({ activation });
    if (handle) {
      store.data.set('x', handle);
    }
    return access.reopen({ id: 'x', name: 'a.pdf' });
  }

  it('FIL-008 returns not-found without a stored handle', async () => {
    expect(await reopenWith(undefined)).toMatchObject({ ok: false, error: 'not-found' });
  });

  it('FIL-008 reads the file when permission is granted', async () => {
    const result = await reopenWith(fakeHandle({ file: pdfFile('a.pdf', [7, 8], 42) }));
    expect(result).toMatchObject({
      ok: true,
      value: { ref: { id: 'x', name: 'a.pdf', size: 2, lastModified: 42 }, writable: true },
    });
  });

  it('FIL-008 asks for permission inside a user gesture', async () => {
    expect(await reopenWith(fakeHandle({ query: 'prompt', request: 'granted' }))).toMatchObject({ ok: true });
  });

  it('FIL-008 returns denied when the permission request is refused', async () => {
    expect(await reopenWith(fakeHandle({ query: 'prompt', request: 'denied' }))).toMatchObject({
      ok: false,
      error: 'denied',
    });
  });

  it('FIL-008 returns needs-user-gesture when a prompt is needed without a gesture', async () => {
    expect(await reopenWith(fakeHandle({ query: 'prompt' }), false)).toMatchObject({
      ok: false,
      error: 'needs-user-gesture',
    });
  });

  it('FIL-008 returns denied when permission is already denied', async () => {
    expect(await reopenWith(fakeHandle({ query: 'denied' }))).toMatchObject({ ok: false, error: 'denied' });
  });

  it('FIL-008 returns not-found when the file is gone', async () => {
    expect(await reopenWith(fakeHandle({ getFileError: new NamedError('NotFoundError') }))).toMatchObject({
      ok: false,
      error: 'not-found',
    });
  });

  it('FIL-008 returns read-failed for other read errors', async () => {
    expect(await reopenWith(fakeHandle({ getFileError: new NamedError('NotReadableError') }))).toMatchObject({
      ok: false,
      error: 'read-failed',
    });
  });
});

describe('WebFileAccess.isSame', () => {
  const ref = (id: string, extra: Partial<FileRef> = {}): FileRef => ({
    id,
    name: 'a.pdf',
    size: 3,
    lastModified: 1000,
    ...extra,
  });

  it('FIL-002 uses isSameEntry when both references have handles', async () => {
    const { access, store } = makeAccess();
    store.data.set('1', fakeHandle({ same: true }));
    store.data.set('2', fakeHandle({ same: true }));
    expect(await access.isSame(ref('1'), ref('2', { name: 'other.pdf' }))).toBe(true);
    store.data.set('1', fakeHandle({ same: false }));
    expect(await access.isSame(ref('1'), ref('2'))).toBe(false);
  });

  it('FIL-002 falls back to name, size and last-modified time', async () => {
    const { access } = makeAccess();
    expect(await access.isSame(ref('1'), ref('2'))).toBe(true);
    expect(await access.isSame(ref('1'), ref('2', { name: 'b.pdf' }))).toBe(false);
    expect(await access.isSame(ref('1'), ref('2', { size: 4 }))).toBe(false);
    expect(await access.isSame(ref('1'), ref('2', { lastModified: 1 }))).toBe(false);
  });

  it('FIL-002 does not treat references without size and time as the same', async () => {
    const { access } = makeAccess();
    expect(await access.isSame({ id: '1', name: 'a.pdf' }, { id: '2', name: 'a.pdf' })).toBe(false);
  });
});

describe('WebFileAccess misc', () => {
  it('FIL-015 forget removes the stored handle', async () => {
    const { access, store } = makeAccess();
    store.data.set('x', fakeHandle());
    await access.forget({ id: 'x', name: 'a.pdf' });
    expect(store.data.size).toBe(0);
  });

  it('FIL-015 forget swallows store errors', async () => {
    const store: HandleStore = {
      get: () => Promise.resolve(undefined),
      put: () => Promise.resolve(),
      delete: () => Promise.reject(new Error('db')),
    };
    await expect(makeAccess({ store }).access.forget({ id: 'x', name: 'a.pdf' })).resolves.toBeUndefined();
  });

  it('FIL-001 write and saveCopy are unsupported until M15', async () => {
    const { access } = makeAccess();
    expect(await access.write({ id: 'x', name: 'a.pdf' }, new Uint8Array())).toMatchObject({ error: 'unsupported' });
    expect(await access.saveCopy('a.pdf', new Uint8Array())).toMatchObject({ error: 'unsupported' });
  });
});
