import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { jumpColorIndex } from '../../core';
import type { DocMarks, MarkPosition, MarkPositions } from '../../core';
import { OrgViewStore } from '../../state/org-view.store';
import { UiStore } from '../../state/ui.store';
import { Icon } from '../shell/icon';
import { IconButton } from '../shell/icon-button';
import { breakLabel, jumpLabel, stopLabel } from './mark-labels';

/** Popup id of the marks list (a sheet when compact, a side panel otherwise). */
export const POPUP_MARK_LIST = 'markList';

const HALF_TURN_DEG = 180;

/** ORG-018, ORG-021: playing-order numbers around a mark; null = none there (start / end of the order) or not reached. */
interface Around {
  readonly previous: number | null;
  readonly next: number | null;
  /** False if the mark is never reached in the playing order (listed at the end, dimmed, numbers unknown). */
  readonly reached: boolean;
}

export type MarkListEntry =
  | ({ readonly kind: 'jump'; readonly id: number; readonly junction: number; readonly pass: number; readonly colorIndex: number } & Around)
  | ({ readonly kind: 'break'; readonly junction: number } & Around)
  | ({ readonly kind: 'stop'; readonly junction: number } & Around);

const UNREACHED: Around = { previous: null, next: null, reached: false };
const reachedAround = (position: MarkPosition): Around => ({ previous: position.previous, next: position.next, reached: true });

/** Tie-break among marks met at the same arrival: the break, then the jump that leaves, then the stop that ends. */
const KIND_RANK = { break: 0, jump: 1, stop: 2 } as const;
/** Order of the unreached tail: jumps, then breaks, then stops. */
const UNREACHED_RANK = { jump: 0, break: 1, stop: 2 } as const;

/**
 * ORG-021: jumps, slide breaks and stops in the order of the final playing order (`markPositions`): a break where its
 * junction is first reached, a jump where it fires, a stop where it ends the order. Marks that are never reached (after a stop,
 * shadowed by an earlier jump with the same origin and pass, never arrived at) follow at the end: jumps in creation order,
 * then breaks, then stops by junction.
 */
export function markListEntries(marks: DocMarks, positions: MarkPositions, paletteSize: number): MarkListEntry[] {
  const keyed: { key: number; rank: number; order: number; entry: MarkListEntry }[] = [];
  const unreached: { rank: number; order: number; entry: MarkListEntry }[] = [];
  const place = (position: MarkPosition | undefined, kind: MarkListEntry['kind'], order: number, make: (around: Around) => MarkListEntry): void => {
    if (position === undefined) {
      unreached.push({ rank: UNREACHED_RANK[kind], order, entry: make(UNREACHED) });
    } else {
      keyed.push({ key: position.index, rank: KIND_RANK[kind], order, entry: make(reachedAround(position)) });
    }
  };
  for (const jump of marks.jumps) {
    place(positions.jumps.get(jump.id), 'jump', jump.id, (around) => ({
      kind: 'jump',
      id: jump.id,
      junction: jump.origin,
      pass: jump.pass,
      colorIndex: jumpColorIndex(jump.id, paletteSize),
      ...around,
    }));
  }
  for (const junction of marks.breaks) {
    place(positions.breaks.get(junction), 'break', junction, (around) => ({ kind: 'break', junction, ...around }));
  }
  for (const junction of marks.stops) {
    place(positions.stops.get(junction), 'stop', junction, (around) => ({ kind: 'stop', junction, ...around }));
  }
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
            <span data-testid="mark-list-label">{{ label(entry) }}</span>
          } @else {
            <span class="mark-icon" [class.break]="entry.kind === 'break'" data-testid="mark-list-icon">
              <app-icon [name]="entry.kind === 'break' ? 'slideBreak' : 'stop'" />
            </span>
            <span data-testid="mark-list-label">{{ label(entry) }}</span>
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
  private startX = 0;
  private startY = 0;
  private swiped = false;

  protected readonly entries = computed(() => {
    const doc = this.view.document();
    return doc === null
      ? []
      : markListEntries(doc.marks(), doc.markPositions(), TUNABLES.colors.jumpPalette.length);
  });

  protected label(entry: MarkListEntry): string {
    switch (entry.kind) {
      case 'jump':
        return jumpLabel(entry.previous, entry.next, entry.pass);
      case 'break':
        return breakLabel(entry.previous, entry.next);
      case 'stop':
        return stopLabel(entry.previous);
    }
  }

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
