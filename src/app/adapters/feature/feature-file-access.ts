import type { FeatureFlags } from '../../ports/feature-flags';
import type { FileAccess, FileAccessError, FileRef, OpenedFile } from '../../ports/file-access';
import { err } from '../../ports/result';
import type { Result } from '../../ports/result';

/** True when stored file handles are in use: recent files, session restore or per-file choices need `reopen`. */
export function persistsFileHandles(flags: FeatureFlags): boolean {
  return flags.recentFiles || flags.sessionRestore || flags.persistFileChoices;
}

/**
 * EDN-001, EDN-005, EDN-008: wraps the file access. Writing needs `autosave`; saving a copy and creating a new file need `saveCopy`; otherwise the
 * inner adapter is never called and the answer is 'unsupported'. Without a handle-persisting switch nothing can be reopened
 * and nothing is forgotten. Picking and `isSame` always pass through (open tabs need them). With every switch on it is a
 * pass-through.
 */
export class FeatureFileAccess implements FileAccess {
  constructor(
    private readonly inner: FileAccess,
    private readonly flags: FeatureFlags,
  ) {}

  pickPdfs(): Promise<Result<readonly OpenedFile[], FileAccessError>> {
    return this.inner.pickPdfs();
  }

  reopen(ref: FileRef): Promise<Result<OpenedFile, FileAccessError>> {
    return persistsFileHandles(this.flags) ? this.inner.reopen(ref) : Promise.resolve(err('not-found'));
  }

  write(ref: FileRef, bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    return this.flags.autosave ? this.inner.write(ref, bytes) : Promise.resolve(err('unsupported'));
  }

  requestWriteAccess(ref: FileRef): Promise<Result<void, FileAccessError>> {
    return this.flags.autosave ? this.inner.requestWriteAccess(ref) : Promise.resolve(err('unsupported'));
  }

  createFile(suggestedName: string): Promise<Result<FileRef, FileAccessError>> {
    return this.flags.saveCopy ? this.inner.createFile(suggestedName) : Promise.resolve(err('unsupported'));
  }

  saveCopy(suggestedName: string, bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    return this.flags.saveCopy ? this.inner.saveCopy(suggestedName, bytes) : Promise.resolve(err('unsupported'));
  }

  isSame(a: FileRef, b: FileRef): Promise<boolean> {
    return this.inner.isSame(a, b);
  }

  forget(ref: FileRef): Promise<void> {
    return persistsFileHandles(this.flags) ? this.inner.forget(ref) : Promise.resolve();
  }
}
