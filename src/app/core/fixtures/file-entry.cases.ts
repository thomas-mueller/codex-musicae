/**
 * Fixtures: core/file-entry
 * Requirements: FIL-022, FIL-024. Written by hand from the requirement texts and the marker order of DEC-165.
 */
import type { FileFlags, FileMarker } from '../file-entry';

const CLEAN: FileFlags = { loadError: false, saveFailed: false, needsWriteAccess: false, needsReopen: false, unsaved: false, readOnly: false };

export const fileMarkerCases: ReadonlyArray<{ id: string; req: string; flags: FileFlags; expected: readonly FileMarker[] }> = [
  { id: 'FM1', req: 'FIL-022', flags: CLEAN, expected: [] },
  { id: 'FM2', req: 'FIL-022', flags: { ...CLEAN, unsaved: true }, expected: ['unsaved'] },
  { id: 'FM3', req: 'FIL-022', flags: { ...CLEAN, readOnly: true }, expected: ['readOnly'] },
  { id: 'FM4', req: 'FIL-022', flags: { ...CLEAN, unsaved: true, readOnly: true }, expected: ['unsaved', 'readOnly'] },
  { id: 'FM5', req: 'FIL-022', flags: { ...CLEAN, loadError: true, readOnly: true }, expected: ['loadError', 'readOnly'] },
  { id: 'FM6', req: 'FIL-022', flags: { ...CLEAN, needsReopen: true, unsaved: true, readOnly: true }, expected: ['needsReopen', 'unsaved', 'readOnly'] },
  { id: 'FM7', req: 'FIL-022', flags: { ...CLEAN, needsWriteAccess: true, unsaved: true }, expected: ['writeAccess', 'unsaved'] },
  { id: 'FM8', req: 'FIL-022', flags: { ...CLEAN, saveFailed: true }, expected: ['saveFailed'] },
  {
    id: 'FM9',
    req: 'FIL-022',
    flags: { loadError: true, saveFailed: true, needsWriteAccess: true, needsReopen: true, unsaved: true, readOnly: true },
    expected: ['loadError', 'saveFailed', 'writeAccess', 'needsReopen', 'unsaved', 'readOnly'],
  },
];

export const adjacentFileCases: ReadonlyArray<{ id: string; req: string; ids: readonly string[]; active: string | null; step: -1 | 1; expected: string | null }> = [
  { id: 'AF1', req: 'FIL-024', ids: ['a', 'b', 'c'], active: 'b', step: -1, expected: 'a' },
  { id: 'AF2', req: 'FIL-024', ids: ['a', 'b', 'c'], active: 'b', step: 1, expected: 'c' },
  { id: 'AF3', req: 'FIL-024', ids: ['a', 'b', 'c'], active: 'a', step: -1, expected: null },
  { id: 'AF4', req: 'FIL-024', ids: ['a', 'b', 'c'], active: 'c', step: 1, expected: null },
  { id: 'AF5', req: 'FIL-024', ids: ['a'], active: 'a', step: 1, expected: null },
  { id: 'AF6', req: 'FIL-024', ids: [], active: null, step: 1, expected: null },
  { id: 'AF7', req: 'FIL-024', ids: ['a', 'b'], active: null, step: 1, expected: null },
  { id: 'AF8', req: 'FIL-024', ids: ['a', 'b'], active: 'gone', step: 1, expected: null },
];
