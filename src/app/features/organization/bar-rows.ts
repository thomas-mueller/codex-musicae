import type { DocMarks } from '../../core';

/** What one bar shows in its row (ORG-011): the break line with scissors and the stop icon. The numbers sit on the systems. */
export interface BarRowData {
  readonly hasBreak: boolean;
  readonly hasStop: boolean;
}

/** Row data for junctions 0..systemCount. */
export function barRows(marks: DocMarks, systemCount: number): Map<number, BarRowData> {
  const breaks = new Set(marks.breaks);
  const stops = new Set(marks.stops);
  const rows = new Map<number, BarRowData>();
  for (let junction = 0; junction <= systemCount; junction++) {
    rows.set(junction, { hasBreak: breaks.has(junction), hasStop: stops.has(junction) });
  }
  return rows;
}
