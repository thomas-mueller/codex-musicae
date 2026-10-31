import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { jumpColorIndex } from '../../core';
import type { DocMarks } from '../../core';
import { OrgViewStore } from '../../state/org-view.store';
import { UiStore } from '../../state/ui.store';
import { Icon } from '../shell/icon';
import { IconButton } from '../shell/icon-button';

/** Popup id of the marks list (a sheet when compact, a side panel otherwise). */
export const POPUP_MARK_LIST = 'markList';

const HALF_TURN_DEG = 180;

export type MarkListEntry =
  | {
      readonly kind: 'jump';
      readonly id: number;
      readonly junction: number;
      /** Print number of the source / target system; null where that end has no system (junction 0 / N). */
      readonly fromSystem: number | null;
      readonly toSystem: number | null;
      readonly pass: number;
      readonly colorIndex: number;
      readonly reached: boolean;
    }
  | { readonly kind: 'break' | 'stop'; readonly junction: number; readonly systemAbove: number; readonly reached: boolean };

type WithoutReached<T> = T extends unknown ? Omit<T, 'reached'> : never;

interface Arrival {
  readonly junction: number;
  /** Number of systems played before this arrival. */
  readonly entriesSoFar: number;
}

interface Replay {
  readonly arrivals: readonly Arrival[];
  /** Arrival (index) at which each jump fired, by jump id. */
  readonly firedAt: ReadonlyMap<number, number>;
  /** Index of the arrival at which a stop ends the playing order; Infinity without a reached stop. */
  readonly endArrival: number;
  /** Systems in the playing order (after the cap and the stops). */
  readonly entryCount: number;
}

/**
 * The arrival events of the replay documented in `core/playing-order` (PLY-002, PLY-006, PLY-008): which jump fires where and
 * where a stop ends the order. The contract exposes only entries and `between`, which omit the arrivals after the last system,
 * so the list needs its own pass over the same rules. `markListEntries` is tested against the playing-order fixtures.
 */
export function replayArrivals(marks: DocMarks, systemCount: number, maxLength: number): Replay {
  const arrivals: Arrival[] = [];
  const firedAt = new Map<number, number>();
  const counts = new Array<number>(systemCount + 1).fill(0);
  let position = 0;
  let entries = 0;
  for (;;) {
    counts[position] = (counts[position] ?? 0) + 1;
    arrivals.push({ junction: position, entriesSoFar: entries });
    const jump = marks.jumps.find((j) => j.origin === position && j.pass === counts[position]);
    if (jump !== undefined) {
      firedAt.set(jump.id, arrivals.length - 1);
      position = jump.target;
      continue;
    }
    if (position === systemCount || entries >= maxLength) {
      break;
    }
    entries++;
    position++;
  }
  const lastArrival = (junction: number): number => arrivals.map((a) => a.junction).lastIndexOf(junction);
  const stopped = marks.stops
    .map((junction) => ({ index: lastArrival(junction) }))
    .filter((stop) => stop.index >= 0)
    .map((stop) => ({ index: stop.index, cut: arrivals[stop.index]!.entriesSoFar }));
  const cut = stopped.reduce((best, stop) => Math.min(best, stop.cut), Number.POSITIVE_INFINITY);
  const endArrival = stopped.filter((stop) => stop.cut === cut).reduce((best, stop) => Math.min(best, stop.index), Number.POSITIVE_INFINITY);
  return { arrivals, firedAt, endArrival, entryCount: Math.min(entries, cut) };
}

/** Tie-break among items met at the same arrival: the break, then the jump that leaves, then the stop that ends. */
const KIND_RANK = { break: 0, jump: 1, stop: 2 } as const;
/** Order of the unreached tail: jumps, then breaks, then stops. */
const UNREACHED_RANK = { jump: 0, break: 1, stop: 2 } as const;

/**
 * ORG-021: jumps, slide breaks and stops in the order of the final playing order: a break where its junction is first
 * reached, a jump where it fires (the `pass`-th arrival at its origin), a stop where it ends the order. Items that are never
 * reached (after a stop, shadowed by an earlier jump with the same origin and pass, or never arrived at) follow at the end:
 * jumps in creation order, then breaks, then stops by junction.
 */
export function markListEntries(marks: DocMarks, systemCount: number, maxLength: number, paletteSize: number): MarkListEntry[] {
  const { arrivals, firedAt, endArrival } = replayArrivals(marks, systemCount, maxLength);
  const firstArrival = (junction: number): number => arrivals.findIndex((a) => a.junction === junction);
  const lastArrival = (junction: number): number => arrivals.map((a) => a.junction).lastIndexOf(junction);
  const keyed: { key: number; rank: number; order: number; entry: MarkListEntry }[] = [];
  const unreached: { rank: number; order: number; entry: MarkListEntry }[] = [];
  const place = (index: number, rank: number, order: number, entry: WithoutReached<MarkListEntry>): void => {
    if (index >= 0 && index <= endArrival) {
      keyed.push({ key: index, rank, order, entry: { ...entry, reached: true } as MarkListEntry });
    } else {
      unreached.push({ rank: UNREACHED_RANK[entry.kind], order, entry: { ...entry, reached: false } as MarkListEntry });
    }
  };
  marks.jumps.forEach((jump) => {
    place(firedAt.get(jump.id) ?? -1, KIND_RANK.jump, jump.id, {
      kind: 'jump',
      id: jump.id,
      junction: jump.origin,
      fromSystem: jump.origin >= 1 ? jump.origin : null,
      toSystem: jump.target + 1 <= systemCount ? jump.target + 1 : null,
      pass: jump.pass,
      colorIndex: jumpColorIndex(jump.id, paletteSize),
    });
  });
  marks.breaks.forEach((junction) => place(firstArrival(junction), KIND_RANK.break, junction, { kind: 'break', junction, systemAbove: junction }));
  marks.stops.forEach((junction) => place(lastArrival(junction), KIND_RANK.stop, junction, { kind: 'stop', junction, systemAbove: junction }));
  keyed.sort((a, b) => a.key - b.key || a.rank - b.rank || a.order - b.order);
  unreached.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return [...keyed, ...unreached].map((item) => item.entry);
}

/** ORG-021: a leftward swipe of at least `markListSwipeMinPx`, no steeper than `gestures.swipeMaxAngleDeg` from horizontal. */
export function isSwipeLeft(dx: number, dy: number): boolean {
  const maxSlope = Math.tan((TUNABLES.gestures.swipeMaxAngleDeg * Math.PI) / HALF_TURN_DEG);
  return dx <= -TUNABLES.layout.markListSwipeMinPx && Math.abs(dy) <= Math.abs(dx) * maxSlope;
}

/**
 * ORG-021: jumps, slide breaks and stops of the active document in playing order. Tap scrolls to the item and selects it;
 * the trash icon or a swipe to the left deletes it.
 */
@Component({
  selector: 'app-mark-list',
  imports: [Icon, IconButton, TranslocoPipe],
  template: `
    <div class="list" role="list" data-testid="mark-list">
      @for (entry of entries(); track key(entry)) {
        <div
          class="entry"
          role="listitem"
          data-testid="mark-list-entry"
          [attr.data-kind]="entry.kind"
          [attr.data-jump-id]="entry.kind === 'jump' ? entry.id : null"
          [attr.data-junction]="entry.junction"
          [class.unreached]="!entry.reached"
          [attr.aria-label]="'a11y.markListEntry' | transloco"
          (pointerdown)="onDown($event)"
          (pointerup)="onUp($event, entry)"
          (click)="onTap(entry)"
        >
          @if (entry.kind === 'jump') {
            <span class="dot" data-testid="mark-list-dot" [style.background]="color(entry.colorIndex)"></span>
            <span data-testid="mark-list-from">{{ entry.fromSystem }}</span>
            <span>{{ arrow }}</span>
            <span data-testid="mark-list-to">{{ entry.toSystem }}</span>
            <span data-testid="mark-list-pass">{{ passPrefix }}{{ entry.pass }}</span>
          } @else {
            <span class="mark-icon" [class.break]="entry.kind === 'break'" data-testid="mark-list-icon">
              <app-icon [name]="entry.kind === 'break' ? 'slideBreak' : 'stop'" />
            </span>
            <span data-testid="mark-list-system">{{ entry.systemAbove }}</span>
          }
          <button appIconButton icon="delete" labelKey="delete" data-testid="mark-list-delete" (click)="$event.stopPropagation()" (pressed)="remove(entry)"></button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .list { display: flex; flex-direction: column; max-height: calc(100% - var(--cm-bar-height) * 2); overflow-y: auto; }
    .entry { display: flex; align-items: center; gap: var(--cm-tab-gap); min-height: var(--cm-touch-target); padding: 0 var(--cm-tab-gap); font-family: monospace; touch-action: pan-y; }
    .entry.unreached { opacity: var(--cm-unreached-opacity); }
    .dot { flex: none; width: var(--cm-dot); height: var(--cm-dot); border-radius: 50%; }
    .mark-icon { display: inline-flex; color: var(--cm-icon); }
    .mark-icon.break { color: var(--cm-break-line); }
    .entry button { margin-left: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkList {
  private readonly view = inject(OrgViewStore);
  private readonly ui = inject(UiStore);
  protected readonly arrow = TUNABLES.layout.listArrow;
  protected readonly passPrefix = TUNABLES.layout.passPrefix;
  private startX = 0;
  private startY = 0;
  private swiped = false;

  protected readonly entries = computed(() => {
    const doc = this.view.document();
    return doc === null
      ? []
      : markListEntries(doc.marks(), doc.junctionCount(), TUNABLES.playingOrder.maxLength, TUNABLES.colors.jumpPalette.length);
  });

  protected key(entry: MarkListEntry): string {
    return entry.kind === 'jump' ? `jump:${entry.id}` : `${entry.kind}:${entry.junction}`;
  }

  protected color(colorIndex: number): string {
    return TUNABLES.colors.jumpPalette[colorIndex] ?? TUNABLES.colors.accent;
  }

  protected onDown(event: PointerEvent): void {
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.swiped = false;
  }

  protected onUp(event: PointerEvent, entry: MarkListEntry): void {
    if (isSwipeLeft(event.clientX - this.startX, event.clientY - this.startY)) {
      this.swiped = true;
      this.remove(entry);
    }
  }

  /** The sheet would cover the bar the list scrolls to, so it closes when compact. */
  protected onTap(entry: MarkListEntry): void {
    const doc = this.view.document();
    if (this.swiped || doc === null) {
      return;
    }
    this.view.scrollToJunction(doc.bars(), entry.junction);
    this.ui.select(entry.kind === 'jump' ? { kind: 'jump', id: entry.id } : { kind: 'junction', junction: entry.junction });
    if (this.ui.sizeClass() === 'compact') {
      this.ui.closePopup();
    }
  }

  protected remove(entry: MarkListEntry): void {
    const doc = this.view.document();
    if (doc === null) {
      return;
    }
    if (entry.kind === 'jump') {
      doc.removeJump(entry.id);
    } else if (entry.kind === 'break') {
      doc.toggleBreak(entry.junction);
    } else {
      doc.toggleStop(entry.junction);
    }
  }
}
