import { TUNABLES } from '../../../config/tunables';

/** A playing-order number, or the placeholder where there is none (start / end of the order, mark not reached). */
export function numberText(value: number | null): string {
  return value === null ? TUNABLES.layout.unknownNumber : String(value);
}

/** ORG-018: "<previous> → <next> ×<pass>", the playing-order numbers of the systems before and after the jump. */
export function jumpLabel(previous: number | null, next: number | null, pass: number): string {
  const { listArrow, passPrefix } = TUNABLES.layout;
  return `${numberText(previous)} ${listArrow} ${numberText(next)} ${passPrefix}${pass}`;
}

/** ORG-021: "<previous> | <next>" for a slide break in the marks list. */
export function breakLabel(previous: number | null, next: number | null): string {
  return `${numberText(previous)} ${TUNABLES.layout.breakSeparator} ${numberText(next)}`;
}

/** ORG-021: "<previous>" for a stop in the marks list. */
export function stopLabel(previous: number | null): string {
  return numberText(previous);
}
