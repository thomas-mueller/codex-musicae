import type { FsFileHandle, HandleStore } from './web-file-access';

/** EDN-005: keeps file handles in memory only, for builds without handle-persisting switches (no IndexedDB is touched). */
export class MemoryHandleStore implements HandleStore {
  private readonly handles = new Map<string, FsFileHandle>();

  get(id: string): Promise<FsFileHandle | undefined> {
    return Promise.resolve(this.handles.get(id));
  }

  put(id: string, handle: FsFileHandle): Promise<void> {
    this.handles.set(id, handle);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.handles.delete(id);
    return Promise.resolve();
  }
}
