/**
 * core/file-entry — the status markers of an open file and its neighbors in the list. Requirements: FIL-022, FIL-024.
 */
export interface FileFlags {
  readonly loadError: boolean;
  readonly saveFailed: boolean;
  readonly needsWriteAccess: boolean;
  readonly needsReopen: boolean;
  readonly unsaved: boolean;
  readonly readOnly: boolean;
}

export type FileMarker = 'loadError' | 'saveFailed' | 'writeAccess' | 'needsReopen' | 'unsaved' | 'readOnly';

/** The markers that apply, most important first (DEC-165): where there is room for one only, it is the first. */
export function fileMarkers(flags: FileFlags): readonly FileMarker[] {
  const ordered: readonly (readonly [FileMarker, boolean])[] = [
    ['loadError', flags.loadError],
    ['saveFailed', flags.saveFailed],
    ['writeAccess', flags.needsWriteAccess],
    ['needsReopen', flags.needsReopen],
    ['unsaved', flags.unsaved],
    ['readOnly', flags.readOnly],
  ];
  return ordered.filter(([, applies]) => applies).map(([marker]) => marker);
}

/** The file before (-1) or after (1) the active one in opening order; null at an end or without an active file. */
export function adjacentFile(ids: readonly string[], activeId: string | null, step: -1 | 1): string | null {
  const index = activeId === null ? -1 : ids.indexOf(activeId);
  return index < 0 ? null : (ids[index + step] ?? null);
}
