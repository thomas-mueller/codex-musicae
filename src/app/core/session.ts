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
export function parseSession(raw: unknown): SessionSnapshot | null {
  if (!isRecord(raw) || raw['version'] !== 1 || !Array.isArray(raw['tabs'])) {
    return null;
  }
  const tabs: TabSnapshot[] = [];
  const seen = new Set<string>();
  for (const item of raw['tabs'] as unknown[]) {
    const tab = parseTab(item);
    if (tab && !seen.has(tab.ref.id)) {
      seen.add(tab.ref.id);
      tabs.push(tab);
    }
  }
  const index = raw['activeIndex'];
  const activeIndex = typeof index === 'number' && Number.isFinite(index) ? Math.min(Math.max(Math.trunc(index), 0), Math.max(tabs.length - 1, 0)) : 0;
  return { version: 1, tabs, activeIndex };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function finiteOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function indexOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseTab(item: unknown): TabSnapshot | null {
  if (!isRecord(item) || !isRecord(item['ref'])) {
    return null;
  }
  const { id, name, size, lastModified } = item['ref'];
  if (!nonEmptyString(id) || !nonEmptyString(name)) {
    return null;
  }
  const finiteSize = finiteOrUndefined(size);
  const finiteModified = finiteOrUndefined(lastModified);
  const offset = finiteOrUndefined(item['orgOffset']);
  return {
    ref: {
      id,
      name,
      ...(finiteSize !== undefined ? { size: finiteSize } : {}),
      ...(finiteModified !== undefined ? { lastModified: finiteModified } : {}),
    },
    system: indexOrZero(item['system']),
    orgPage: indexOrZero(item['orgPage']),
    orgOffset: offset !== undefined && offset >= 0 ? offset : 0,
  };
}
