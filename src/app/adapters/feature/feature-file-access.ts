import type { FeatureFlags } from '../../ports/feature-flags';
import type { FileAccess, FileAccessError, FileRef, OpenedFile } from '../../ports/file-access';
import { err } from '../../ports/result';
import type { Result } from '../../ports/result';

/** True when file handles are stored between app starts: recent files, session restore or per-file choices need that. */
export function persistsFileHandles(flags: FeatureFlags): boolean {
  return flags.recentFiles || flags.sessionRestore || flags.persistFileChoices;
}

/**
 * EDN-001, EDN-005, EDN-008: wraps the file access. Writing needs `autosave`; creating a new file and downloading a copy
 * need `saveCopy`; otherwise the inner adapter is never called and the answer is 'unsupported'. Picking, reopening,
 * forgetting and `isSame` always pass through (EDN-017): the recent list of the current run needs them in every edition.
 * Whether file handles are stored between runs is decided where the adapter is built (`persistsFileHandles`).
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
    return this.inner.reopen(ref);
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
    return this.inner.forget(ref);
  }
}
