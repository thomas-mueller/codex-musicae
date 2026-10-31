import { TUNABLES } from '../../../config/tunables';
import type { FileAccess, FileAccessError, FileRef, OpenedFile } from '../../ports/file-access';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';

/** The File System Access handle API is not in the TypeScript DOM lib; only what the adapter uses. */
export interface FsFileHandle {
  readonly name: string;
  getFile(): Promise<File>;
  isSameEntry(other: FsFileHandle): Promise<boolean>;
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}

export type OpenFilePicker = (options: {
  multiple: boolean;
  types: Array<{ accept: Record<string, string[]> }>;
}) => Promise<FsFileHandle[]>;

/** FIL-015: persists file handles (never bytes) by `FileRef.id`. */
export interface HandleStore {
  get(id: string): Promise<FsFileHandle | undefined>;
  put(id: string, handle: FsFileHandle): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface WebFileAccessOptions {
  readonly handleStore?: HandleStore;
  readonly newId?: () => string;
  /** Resolved at call time; undefined = no File System Access API (use the input fallback). */
  readonly getPicker?: () => OpenFilePicker | undefined;
  /** Opens the platform file input; resolves with the chosen files (empty = cancelled). */
  readonly pickViaInput?: () => Promise<File[]>;
  readonly hasUserActivation?: () => boolean;
}

export class IndexedDbHandleStore implements HandleStore {
  private db: Promise<IDBDatabase> | null = null;

  get(id: string): Promise<FsFileHandle | undefined> {
    return this.run('readonly', (store) => store.get(id)) as Promise<FsFileHandle | undefined>;
  }

  async put(id: string, handle: FsFileHandle): Promise<void> {
    await this.run('readwrite', (store) => store.put(handle, id));
  }

  async delete(id: string): Promise<void> {
    await this.run('readwrite', (store) => store.delete(id));
  }

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(TUNABLES.files.handleDbName, TUNABLES.files.handleDbVersion);
      request.onupgradeneeded = () => request.result.createObjectStore(TUNABLES.files.handleStoreName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async run(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = op(db.transaction(TUNABLES.files.handleStoreName, mode).objectStore(TUNABLES.files.handleStoreName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

function errorName(e: unknown): string {
  return e instanceof Error || e instanceof DOMException ? e.name : '';
}

function pickError(e: unknown): FileAccessError {
  switch (errorName(e)) {
    case 'AbortError':
      return 'cancelled';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    default:
      return 'read-failed';
  }
}

function readError(e: unknown): FileAccessError {
  switch (errorName(e)) {
    case 'NotFoundError':
      return 'not-found';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    default:
      return 'read-failed';
  }
}

function defaultPicker(): OpenFilePicker | undefined {
  const picker = (window as unknown as { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker;
  return picker ? picker.bind(window) : undefined;
}

/** The input must be clicked synchronously inside the user gesture. */
function defaultPickViaInput(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = TUNABLES.files.pdfMimeType;
    input.hidden = true;
    const finish = (files: File[]): void => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])));
    input.addEventListener('cancel', () => finish([]));
    document.body.appendChild(input);
    input.click();
  });
}

function defaultHasUserActivation(): boolean {
  return navigator.userActivation?.isActive ?? false;
}

function refOf(id: string, file: File): FileRef {
  return { id, name: file.name, size: file.size, lastModified: file.lastModified };
}

export class WebFileAccess implements FileAccess {
  private readonly handleStore: HandleStore;
  private readonly newId: () => string;
  private readonly getPicker: () => OpenFilePicker | undefined;
  private readonly pickViaInput: () => Promise<File[]>;
  private readonly hasUserActivation: () => boolean;

  constructor(options: WebFileAccessOptions = {}) {
    this.handleStore = options.handleStore ?? new IndexedDbHandleStore();
    this.newId = options.newId ?? (() => crypto.randomUUID());
    this.getPicker = options.getPicker ?? defaultPicker;
    this.pickViaInput = options.pickViaInput ?? defaultPickViaInput;
    this.hasUserActivation = options.hasUserActivation ?? defaultHasUserActivation;
  }

  async pickPdfs(): Promise<Result<readonly OpenedFile[], FileAccessError>> {
    const picker = this.getPicker();
    // Call before any await: the file input needs the user gesture.
    return picker ? this.pickWithHandles(picker) : this.pickWithInput();
  }

  async reopen(ref: FileRef): Promise<Result<OpenedFile, FileAccessError>> {
    const handle = await this.handleOf(ref);
    if (!handle) {
      return err('not-found');
    }
    try {
      const descriptor = { mode: 'readwrite' } as const;
      let permission = await handle.queryPermission(descriptor);
      if (permission === 'prompt') {
        if (!this.hasUserActivation()) {
          return err('needs-user-gesture');
        }
        permission = await handle.requestPermission(descriptor);
      }
      if (permission !== 'granted') {
        return err('denied');
      }
      const file = await handle.getFile();
      return ok({ ref: refOf(ref.id, file), bytes: new Uint8Array(await file.arrayBuffer()), writable: true });
    } catch (e) {
      return err(readError(e));
    }
  }

  write(_ref: FileRef, _bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    return Promise.resolve(err('unsupported'));
  }

  saveCopy(_suggestedName: string, _bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    return Promise.resolve(err('unsupported'));
  }

  async isSame(a: FileRef, b: FileRef): Promise<boolean> {
    const [handleA, handleB] = await Promise.all([this.handleOf(a), this.handleOf(b)]);
    if (handleA && handleB) {
      try {
        return await handleA.isSameEntry(handleB);
      } catch {
        // fall through to the metadata comparison
      }
    }
    return (
      a.size !== undefined &&
      a.lastModified !== undefined &&
      a.name === b.name &&
      a.size === b.size &&
      a.lastModified === b.lastModified
    );
  }

  async forget(ref: FileRef): Promise<void> {
    try {
      await this.handleStore.delete(ref.id);
    } catch {
      // nothing stored or storage unavailable
    }
  }

  private async handleOf(ref: FileRef): Promise<FsFileHandle | undefined> {
    try {
      return await this.handleStore.get(ref.id);
    } catch {
      return undefined;
    }
  }

  private async pickWithHandles(picker: OpenFilePicker): Promise<Result<readonly OpenedFile[], FileAccessError>> {
    let handles: FsFileHandle[];
    try {
      handles = await picker({
        multiple: true,
        types: [{ accept: { [TUNABLES.files.pdfMimeType]: [TUNABLES.files.pdfExtension] } }],
      });
    } catch (e) {
      return err(pickError(e));
    }
    if (handles.length === 0) {
      return err('cancelled');
    }
    const opened: OpenedFile[] = [];
    try {
      for (const handle of handles) {
        const file = await handle.getFile();
        const id = this.newId();
        const bytes = new Uint8Array(await file.arrayBuffer());
        await this.handleStore.put(id, handle);
        opened.push({ ref: refOf(id, file), bytes, writable: true });
      }
    } catch (e) {
      return err(pickError(e));
    }
    return ok(opened);
  }

  private async pickWithInput(): Promise<Result<readonly OpenedFile[], FileAccessError>> {
    const files = await this.pickViaInput();
    if (files.length === 0) {
      return err('cancelled');
    }
    try {
      const opened: OpenedFile[] = [];
      for (const file of files) {
        opened.push({
          ref: refOf(this.newId(), file),
          bytes: new Uint8Array(await file.arrayBuffer()),
          writable: false,
        });
      }
      return ok(opened);
    } catch {
      return err('read-failed');
    }
  }
}
