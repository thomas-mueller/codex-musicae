import { TUNABLES } from '../config/tunables';
import { CURRENT_SCHEMA_VERSION, EMPTY_SYSTEM_MARKS, serializeMetadata } from '../app/core';
import type { SystemMarks } from '../app/core';
import type { OpenedFile } from '../app/ports/file-access';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
/** Landscape ratio of the test files: a slide holds one or two systems. */
const RATIO = 1.6;
export const SYSTEMS_PER_PAGE = 3;
const SYSTEM = { x: 50, y: 50, width: 500, height: 150 };
const SYSTEM_PITCH = 250;
/** Above every mark id the specs use. */
const NEXT_ID = 100;

/** An opened file of two pages; `key` is its one byte, by which `testMetadata` is found again. */
export const testFile = (name: string, key: number, id = `id-${name}`): OpenedFile => ({
  ref: { id, name },
  bytes: new Uint8Array([key]),
  writable: true,
});

/** What a file with two detected pages of three systems and these marks has embedded. */
export function testMetadata(marks: Partial<SystemMarks> = {}, systemsPerPage = SYSTEMS_PER_PAGE): string {
  const systems = Array.from({ length: systemsPerPage }, (_, i) => ({ ...SYSTEM, y: SYSTEM.y + i * SYSTEM_PITCH }));
  return serializeMetadata({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: 'v0.0.0-test',
    pageCount: 2,
    detection: {
      level: TUNABLES.detection.defaultLevel,
      pages: [0, 1].map((pageIndex) => ({ pageIndex, width: PAGE_WIDTH, height: PAGE_HEIGHT, state: 'done' as const, systems })),
    },
    marks: { ...EMPTY_SYSTEM_MARKS, nextJumpId: NEXT_ID, nextBookmarkId: NEXT_ID, ...marks },
    aspectRatio: { portrait: RATIO, landscape: RATIO },
  });
}

/** A jump from the right side of system `system` of the first page to the same system of the first page of `file`. */
export const jumpInto = (file: string, system: number, id = 1, targetSystem = system) => ({
  id,
  from: { pageIndex: 0, system },
  to: { file, pageIndex: 0, system: targetSystem },
  pass: 1,
});
