import { InjectionToken } from '@angular/core';

/**
 * Port FeatureFlags (EDN-007): the read-only feature switches of this build, provided by the composition root.
 * EDN-017: a switch exists only for saving changes or keeping data between app starts; everything else is in every edition.
 * Features read this token, never the files in config/. The values are fixed at build time (ARC-009).
 */
export interface FeatureFlags {
  /** Saves changes into the PDF automatically. */
  readonly autosave: boolean;
  /** Save as a new file: the PDF with notes written elsewhere (a download where no file can be chosen). */
  readonly saveCopy: boolean;
  /** Send to other apps. */
  readonly sendTo: boolean;
  /** Keep the list of recently opened files between app starts. */
  readonly recentFiles: boolean;
  /** Reopen the previous tabs at startup. */
  readonly sessionRestore: boolean;
  /** Store settings between runs. */
  readonly persistSettings: boolean;
  /** Store per-file choices. */
  readonly persistFileChoices: boolean;
  /** Restore the zoom of a file when it is opened again. */
  readonly restoreZoom: boolean;
  /** Web only (R-22l, EDN-009): organizational web pages; absent in native builds. */
  readonly webOrganizational?: boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS');
