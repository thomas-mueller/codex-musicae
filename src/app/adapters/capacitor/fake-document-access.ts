import type { DocumentAccessApi, NativeFile } from './document-access-plugin';
import { encodeBase64 } from './base64';

/** In-memory stand-in for the native plugin, shared by the adapter specs. */
export interface FakeDocumentAccess extends DocumentAccessApi {
  readonly files: Map<string, { bytes: Uint8Array; writable: boolean }>;
  readonly calls: string[];
  picked: NativeFile[];
  created: string | undefined;
  pending: NativeFile[];
  /** Makes the named method reject with this code. */
  fail: Map<string, string>;
  emitIncoming(): void;
}

export function fakeDocumentAccess(): FakeDocumentAccess {
  const readers = new Map<string, Uint8Array>();
  const writers = new Map<string, { id: string; parts: number[][] }>();
  let listener: (() => void) | null = null;
  let counter = 0;

  const reject = (method: string): void => {
    const code = fake.fail.get(method);
    if (code !== undefined) {
      throw Object.assign(new Error(method), { code });
    }
  };

  const fake: FakeDocumentAccess = {
    files: new Map(),
    calls: [],
    picked: [],
    created: undefined,
    pending: [],
    fail: new Map(),
    emitIncoming: () => listener?.(),
    pickDocuments: () => {
      fake.calls.push('pickDocuments');
      reject('pickDocuments');
      return Promise.resolve({ files: fake.picked });
    },
    openRead: ({ id }) => {
      fake.calls.push('openRead');
      reject('openRead');
      const file = fake.files.get(id);
      if (!file) throw Object.assign(new Error('unknown'), { code: 'not-found' });
      const handle = `r${++counter}`;
      readers.set(handle, file.bytes);
      return Promise.resolve({ handle, size: file.bytes.length, writable: file.writable });
    },
    readChunk: ({ handle, offset, length }) => {
      fake.calls.push(`readChunk:${offset}:${length}`);
      reject('readChunk');
      return Promise.resolve({ data: encodeBase64((readers.get(handle) as Uint8Array).subarray(offset, offset + length)) });
    },
    closeRead: ({ handle }) => {
      fake.calls.push('closeRead');
      readers.delete(handle);
      return Promise.resolve();
    },
    openWrite: ({ id }) => {
      fake.calls.push('openWrite');
      reject('openWrite');
      const handle = `w${++counter}`;
      writers.set(handle, { id, parts: [] });
      return Promise.resolve({ handle });
    },
    writeChunk: ({ handle, data }) => {
      fake.calls.push('writeChunk');
      reject('writeChunk');
      writers.get(handle)?.parts.push(Array.from(atob(data), (c) => c.charCodeAt(0)));
      return Promise.resolve();
    },
    commitWrite: ({ handle }) => {
      fake.calls.push('commitWrite');
      reject('commitWrite');
      const session = writers.get(handle) as { id: string; parts: number[][] };
      fake.files.set(session.id, { bytes: Uint8Array.from(session.parts.flat()), writable: true });
      writers.delete(handle);
      return Promise.resolve();
    },
    abortWrite: ({ handle }) => {
      fake.calls.push('abortWrite');
      writers.delete(handle);
      return Promise.resolve();
    },
    createDocument: () => {
      fake.calls.push('createDocument');
      if (fake.created !== undefined) fake.files.set(fake.created, { bytes: new Uint8Array(), writable: true });
      return Promise.resolve(fake.created === undefined ? {} : { id: fake.created });
    },
    isPersisted: ({ id }) => Promise.resolve({ persisted: fake.files.has(id) }),
    forget: ({ id }) => {
      fake.calls.push(`forget:${id}`);
      return Promise.resolve();
    },
    getPendingIncoming: () => {
      const files = fake.pending;
      fake.pending = [];
      return Promise.resolve({ files });
    },
    addListener: (_event, fn) => {
      listener = fn;
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
  };
  return fake;
}
