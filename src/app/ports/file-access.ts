/**
 * Port FileAccess (first used in M8; write/saveCopy in M15; restore and open-with in M16).
 * Implementations: web (File System Access, download fallback), Android (Storage Access Framework plugin).
 * `FileRef` is plain JSON; the implementation keeps the real handle/URI in its own storage keyed by `id`.
 */
import { InjectionToken } from '@angular/core';
import type { Result } from './result';

export type FileAccessError =
  | 'cancelled'
  | 'denied'
  | 'not-found'
  | 'read-failed'
  | 'write-failed'
  | 'unsupported'
  | 'needs-user-gesture';

export interface FileRef {
  readonly id: string;
  readonly name: string;
  readonly size?: number;
  readonly lastModified?: number;
}

export interface OpenedFile {
  readonly ref: FileRef;
  readonly bytes: Uint8Array;
  /** True when in-place writing is expected to work. */
  readonly writable: boolean;
}

export interface FileAccess {
  /** Platform picker for PDFs, multiple selection. */
  pickPdfs(): Promise<Result<readonly OpenedFile[], FileAccessError>>;
  /** Reopens a persisted reference; may return 'needs-user-gesture' (web permission prompt). */
  reopen(ref: FileRef): Promise<Result<OpenedFile, FileAccessError>>;
  /** Writes the complete bytes to the same file. */
  write(ref: FileRef, bytes: Uint8Array): Promise<Result<void, FileAccessError>>;
  /** Saves as a new file (download or document-create). */
  saveCopy(suggestedName: string, bytes: Uint8Array): Promise<Result<void, FileAccessError>>;
  /** FIL-002: true if both refer to the same underlying file. */
  isSame(a: FileRef, b: FileRef): Promise<boolean>;
  /** Drops the stored handle/permission for a reference. */
  forget(ref: FileRef): Promise<void>;
}

export const FILE_ACCESS = new InjectionToken<FileAccess>('FileAccess');
