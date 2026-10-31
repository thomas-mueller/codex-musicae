import { TUNABLES } from '../../../config/tunables';
import { jumpColorIndex, junctionLabel } from '../../core';
import type { Bar, DocMarks, JunctionLabel } from '../../core';

/** One badge on a bar (ORG-018): an origin badge shows the target label and the pass, a target badge the origin label. */
export interface JumpBadge {
  readonly jumpId: number;
  readonly role: 'origin' | 'target';
  /** The junction at the other end of the jump; long press scrolls there (ORG-019). */
  readonly otherJunction: number;
  /** Label of the other end as "page·bar", e.g. "7·1". */
  readonly otherLabel: string;
  readonly pass: number;
  readonly colorIndex: number;
}

export function formatLabel(label: JunctionLabel): string {
  return `${label.page}${TUNABLES.layout.labelSeparator}${label.ordinal}`;
}

/**
 * Badges per junction, in jump creation order. Keyed by junction, so both bars of a page-change junction show them.
 * A jump whose end has no bar yet (outside the usable prefix) gets no badge at that end.
 */
export function jumpBadges(marks: DocMarks, bars: readonly Bar[], paletteSize: number): Map<number, JumpBadge[]> {
  const result = new Map<number, JumpBadge[]>();
  const add = (junction: number, badge: JumpBadge): void => {
    result.set(junction, [...(result.get(junction) ?? []), badge]);
  };
  for (const jump of marks.jumps) {
    const target = junctionLabel(bars, jump.target);
    const origin = junctionLabel(bars, jump.origin);
    const colorIndex = jumpColorIndex(jump.id, paletteSize);
    if (target !== null) {
      add(jump.origin, { jumpId: jump.id, role: 'origin', otherJunction: jump.target, otherLabel: formatLabel(target), pass: jump.pass, colorIndex });
    }
    if (origin !== null) {
      add(jump.target, { jumpId: jump.id, role: 'target', otherJunction: jump.origin, otherLabel: formatLabel(origin), pass: jump.pass, colorIndex });
    }
  }
  return result;
}
