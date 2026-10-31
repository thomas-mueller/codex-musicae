import { TUNABLES } from '../../../config/tunables';
import type { DocMarks } from '../../core';

/** What one bar shows in its row (ORG-011). */
export interface BarRowData {
  /** Numbers of the system above the junction, ascending, e.g. "3, 9"; empty for junction 0 (ORG-012). */
  readonly numbersText: string;
  readonly hasBreak: boolean;
  readonly hasStop: boolean;
}

/**
 * Row data for junctions 0..systemCount. `numbers[i]` belongs to system i + 1 (`systemNumbers`), so junction j shows
 * `numbers[j - 1]`. Both bars of a page-change junction share the entry, hence show the same text.
 */
export function barRows(numbers: readonly (readonly number[])[], marks: DocMarks, systemCount: number): Map<number, BarRowData> {
  const breaks = new Set(marks.breaks);
  const stops = new Set(marks.stops);
  const rows = new Map<number, BarRowData>();
  for (let junction = 0; junction <= systemCount; junction++) {
    rows.set(junction, {
      numbersText: junction === 0 ? '' : (numbers[junction - 1] ?? []).join(TUNABLES.layout.numberSeparator),
      hasBreak: breaks.has(junction),
      hasStop: stops.has(junction),
    });
  }
  return rows;
}
