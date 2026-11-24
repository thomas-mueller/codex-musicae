import { InjectionToken } from '@angular/core';

/**
 * Port FeatureFlags (EDN-007): the read-only feature switches of this build, provided by the composition root.
 * Features read this token, never the files in config/. The values are fixed at build time (ARC-009).
 */
export interface FeatureFlags {
  /** Saves changes into the PDF automatically. */
  readonly autosave: boolean;
  /** Save a copy / export of the PDF with notes. */
  readonly saveCopy: boolean;
  /** Send to other apps. */
  readonly sendTo: boolean;
  /** Remember and list recently opened files. */
  readonly recentFiles: boolean;
  /** Reopen the previous tabs at startup. */
  readonly sessionRestore: boolean;
  /** Store settings between runs. */
  readonly persistSettings: boolean;
  /** Store per-file choices. */
  readonly persistFileChoices: boolean;
  /** Restore the zoom of a file when it is opened again. */
  readonly restoreZoom: boolean;
  /** Open the next file of a set automatically at its end. */
  readonly crossFileAutoOpen: boolean;
  /** Receive files shared from other apps. */
  readonly shareIn: boolean;
  /** Web only (R-22l, EDN-009): organizational web pages; absent in native builds. */
  readonly webOrganizational?: boolean;
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS');
