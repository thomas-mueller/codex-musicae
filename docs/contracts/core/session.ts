/**
 * core/session — the persisted session (tabs and positions). Requirements: FIL-011, FIL-013, FIL-014, NFR-015.
 * Pure validation of what comes back from the preferences store (anything may be stored there).
 */

export interface FileRefData {
  readonly id: string;
  readonly name: string;
  readonly size?: number;
  readonly lastModified?: number;
}

export interface TabSnapshot {
  readonly ref: FileRefData;
  /** System index of the first entry on the current slide (FIL-014); 0 if unknown. */
  readonly system: number;
  /** Organization mode position. */
  readonly orgPage: number;
  readonly orgOffset: number;
}

export interface SessionSnapshot {
  readonly version: 1;
  readonly tabs: readonly TabSnapshot[];
  readonly activeIndex: number;
}

/**
 * Validates arbitrary data. Returns null unless `raw` is an object with version === 1 and a `tabs` array.
 * Tabs that are not valid are dropped (valid = object with ref.id and ref.name non-empty strings; size and lastModified kept only if
 * finite numbers; system, orgPage integers >= 0 else 0; orgOffset finite number >= 0 else 0). `activeIndex` is clamped to
 * 0..tabs.length-1 (0 if there are no tabs; invalid or missing -> 0). Duplicate ref ids: keep the first.
 */
export function parseSession(_raw: unknown): SessionSnapshot | null {
  throw new Error('not implemented');
}
