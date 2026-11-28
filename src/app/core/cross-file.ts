/**
 * core/cross-file — the files a document refers to, how one is found by its name and what state a reference is in.
 * Requirements: MRK-012, MRK-015, MRK-016, FIL-042, FIL-043. The file name is the only identity (D-1).
 */
import { isCrossFile } from './marks';
import type { FileRef, SystemMarks } from './marks';

/** Every cross-file reference of the marks: jump targets and bookmark targets. */
export function crossReferences(marks: SystemMarks): readonly FileRef[] {
  return [
    ...marks.jumps.flatMap((jump) => (isCrossFile(jump.to) ? [jump.to] : [])),
    ...marks.bookmarks.flatMap((bookmark) => (bookmark.ref === undefined ? [] : [bookmark.ref])),
  ];
}

/** The names of the referenced files, each once, in the order of the references. */
export function referencedFiles(marks: SystemMarks): readonly string[] {
  return [...new Set(crossReferences(marks).map((reference) => reference.file))];
}

interface NamedFile {
  readonly id: string;
  readonly name: string;
}

export type FileLookup =
  | { readonly kind: 'open'; readonly id: string }
  | { readonly kind: 'reopen'; readonly id: string }
  | { readonly kind: 'none' }
  | { readonly kind: 'several' };

/**
 * FIL-042, FIL-043: finds a file by name, first among the open files (without the referring one, which the caller leaves out),
 * then among the files the app keeps access to. More than one match is no match.
 */
export function lookupFile(name: string, open: readonly NamedFile[], accessible: readonly NamedFile[]): FileLookup {
  for (const [kind, list] of [['open', open], ['reopen', accessible]] as const) {
    const matches = list.filter((file) => file.name === name);
    if (matches.length > 1) {
      return { kind: 'several' };
    }
    if (matches[0]) {
      return { kind, id: matches[0].id };
    }
  }
  return { kind: 'none' };
}

/** What is known of the one open file a reference names. */
export interface TargetLayout {
  readonly pageCount: number;
  /** Systems per page of the pages detected so far, from the first page on. */
  readonly pageSystemCounts: readonly number[];
  /** The file could not be opened. */
  readonly failed: boolean;
}

export type TargetState = 'resolved' | 'pending' | 'missing-file' | 'ambiguous' | 'missing-system';

/**
 * MRK-015, MRK-016: `matches` are the open files of that name. 'pending' while the target file is loading or its detection
 * has not reached the target's page.
 */
export function targetState(reference: FileRef, matches: readonly TargetLayout[]): TargetState {
  if (matches.length !== 1) {
    return matches.length === 0 ? 'missing-file' : 'ambiguous';
  }
  const target = matches[0]!;
  if (target.failed) {
    return 'missing-file';
  }
  if (target.pageCount === 0) {
    return 'pending';
  }
  if (reference.pageIndex >= target.pageCount) {
    return 'missing-system';
  }
  const count = target.pageSystemCounts[reference.pageIndex];
  if (count === undefined) {
    return 'pending';
  }
  return reference.system <= count ? 'resolved' : 'missing-system';
}
