import type { DocMarks } from '../../core';

/** ORG-016: a new jump starts at the occurrence after the existing jumps of its origin: their number plus one. */
export function nextPass(marks: DocMarks, origin: number): number {
  return marks.jumps.filter((jump) => jump.origin === origin).length + 1;
}
