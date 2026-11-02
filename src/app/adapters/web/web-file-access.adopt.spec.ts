import { describe, expect, it } from 'vitest';

import { WebFileAccess } from './web-file-access';
import type { FsFileHandle, HandleStore } from './web-file-access';

function setup(handle: Partial<FsFileHandle> & { getFile: FsFileHandle['getFile'] }) {
  const data = new Map<string, FsFileHandle>();
  const store: HandleStore = {
    get: (id) => Promise.resolve(data.get(id)),
    put: (id, h) => {
      data.set(id, h);
      return Promise.resolve();
    },
    delete: (id) => {
      data.delete(id);
      return Promise.resolve();
    },
  };
  return { data, access: new WebFileAccess({ handleStore: store, newId: () => 'id-1' }), handle: handle as FsFileHandle };
}

const file = new File([new Uint8Array([1, 2, 3])], 'a.pdf', { lastModified: 7 });

describe('WebFileAccess.adoptHandle', () => {
  it('FIL-019 reads the launched file, stores its handle under a new id and marks it writable', async () => {
    const { access, data, handle } = setup({ getFile: () => Promise.resolve(file), createWritable: () => Promise.reject(new Error('unused')) });
    const opened = await access.adoptHandle(handle);
    expect(opened?.ref).toEqual({ id: 'id-1', name: 'a.pdf', size: 3, lastModified: 7 });
    expect(opened?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(opened?.writable).toBe(true);
    expect(data.get('id-1')).toBe(handle);
  });

  it('FIL-019 a handle that cannot write opens read-only; an unreadable handle gives null', async () => {
    const readOnly = setup({ getFile: () => Promise.resolve(file) });
    expect((await readOnly.access.adoptHandle(readOnly.handle))?.writable).toBe(false);
    const broken = setup({ getFile: () => Promise.reject(new Error('gone')) });
    expect(await broken.access.adoptHandle(broken.handle)).toBeNull();
    expect(broken.data.size).toBe(0);
  });
});
