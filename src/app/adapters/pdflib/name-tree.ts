import { PDFArray, PDFDict, PDFRef, PDFString } from 'pdf-lib';
import type { PDFDocument, PDFObject } from 'pdf-lib';

import { arrayOf, dictOf, name, textOf } from './pdf-objects';

const NAMES = 'Names';
const KIDS = 'Kids';
const LIMITS = 'Limits';
const EMBEDDED_FILES = 'EmbeddedFiles';
const PAIR = 2;

export interface TreeEntry {
  readonly names: PDFArray;
  /** Index of the key in `names`; the value follows at index + 1. */
  readonly index: number;
}

/** Finds `key` in a name tree node, descending through `/Kids`. */
export function findEntry(node: PDFDict, key: string): TreeEntry | null {
  const names = arrayOf(node, NAMES);
  for (let i = 0; names && i + 1 < names.size(); i += PAIR) {
    if (textOf(names.lookup(i)) === key) {
      return { names, index: i };
    }
  }
  const kids = arrayOf(node, KIDS);
  for (let i = 0; kids && i < kids.size(); i++) {
    const kid = kids.lookupMaybe(i, PDFDict);
    const found = kid ? findEntry(kid, key) : null;
    if (found) {
      return found;
    }
  }
  return null;
}

/** The `/EmbeddedFiles` tree root; created (with the catalog's `/Names`) when `create` is set. */
export function embeddedFilesRoot(doc: PDFDocument, create: boolean): PDFDict | undefined {
  const { catalog, context } = doc;
  let namesDict = dictOf(catalog, NAMES);
  if (!namesDict && create) {
    namesDict = context.obj({});
    catalog.set(name(NAMES), namesDict);
  }
  let root = namesDict ? dictOf(namesDict, EMBEDDED_FILES) : undefined;
  if (namesDict && !root && create) {
    root = context.obj({ [NAMES]: [] });
    namesDict.set(name(EMBEDDED_FILES), root);
  }
  return root;
}

/** Deletes a file specification and its embedded stream. */
export function deleteFileSpec(doc: PDFDocument, value: PDFObject | undefined): void {
  if (!(value instanceof PDFRef)) {
    return;
  }
  const spec = doc.context.lookupMaybe(value, PDFDict);
  const stream = spec ? dictOf(spec, 'EF')?.get(name('F')) : undefined;
  if (stream instanceof PDFRef) {
    doc.context.delete(stream);
  }
  doc.context.delete(value);
}

function lowerLimit(kid: PDFDict): string | null {
  const limits = arrayOf(kid, LIMITS);
  return limits ? textOf(limits.lookup(0)) : null;
}

/**
 * SAV-010: registers `spec` under `key`. An existing entry is replaced (old specification and stream deleted); in a flat
 * tree a new entry goes in key order; below `/Kids` it becomes a new leaf with `/Limits` at its sorted place.
 */
export function setEmbeddedFile(doc: PDFDocument, key: string, spec: PDFRef): void {
  const root = embeddedFilesRoot(doc, true) as PDFDict;
  const existing = findEntry(root, key);
  if (existing) {
    deleteFileSpec(doc, existing.names.get(existing.index + 1));
    existing.names.set(existing.index + 1, spec);
    return;
  }
  const kids = arrayOf(root, KIDS);
  if (kids) {
    const leaf = doc.context.register(doc.context.obj({ [LIMITS]: [PDFString.of(key), PDFString.of(key)], [NAMES]: [PDFString.of(key), spec] }));
    let at = kids.size();
    for (let i = 0; i < kids.size(); i++) {
      const lower = lowerLimit(kids.lookupMaybe(i, PDFDict) ?? doc.context.obj({}));
      if (lower !== null && lower > key) {
        at = i;
        break;
      }
    }
    kids.insert(at, leaf);
    return;
  }
  let names = arrayOf(root, NAMES);
  if (!names) {
    names = doc.context.obj([]);
    root.set(name(NAMES), names);
  }
  let at = names.size();
  for (let i = 0; i + 1 < names.size(); i += PAIR) {
    const existingKey = textOf(names.lookup(i));
    if (existingKey !== null && existingKey > key) {
      at = i;
      break;
    }
  }
  names.insert(at, PDFString.of(key));
  names.insert(at + 1, spec);
}

