import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { jumpColorIndex, junctionLabel } from '../../core';
import type { Bar, DocMarks } from '../../core';
import { OrgViewStore } from '../../state/org-view.store';
import { UiStore } from '../../state/ui.store';
import { IconButton } from '../shell/icon-button';
import { formatLabel } from './jump-badges';

/** Popup id of the jump list (a sheet when compact, a side panel otherwise). */
export const POPUP_JUMP_LIST = 'jumpList';

const HALF_TURN_DEG = 180;

export interface JumpListEntry {
  readonly id: number;
  readonly origin: number;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly pass: number;
  readonly colorIndex: number;
}

/**
 * ORG-021: one entry per jump in creation order. A jump whose origin or target has no bar yet (outside the usable
 * prefix) is left out until that page is processed.
 */
export function jumpListEntries(marks: DocMarks, bars: readonly Bar[], paletteSize: number): JumpListEntry[] {
  return marks.jumps.flatMap((jump) => {
    const from = junctionLabel(bars, jump.origin);
    const to = junctionLabel(bars, jump.target);
    return from === null || to === null
      ? []
      : [{ id: jump.id, origin: jump.origin, fromLabel: formatLabel(from), toLabel: formatLabel(to), pass: jump.pass, colorIndex: jumpColorIndex(jump.id, paletteSize) }];
  });
}

/** ORG-021: a leftward swipe of at least `jumpListSwipeMinPx`, no steeper than `gestures.swipeMaxAngleDeg` from horizontal. */
export function isSwipeLeft(dx: number, dy: number): boolean {
  const maxSlope = Math.tan((TUNABLES.gestures.swipeMaxAngleDeg * Math.PI) / HALF_TURN_DEG);
  return dx <= -TUNABLES.layout.jumpListSwipeMinPx && Math.abs(dy) <= Math.abs(dx) * maxSlope;
}

/** ORG-021: the entries of the active document's jumps; tap scrolls to the origin bar and selects the jump; delete icon or swipe-left deletes. */
@Component({
  selector: 'app-jump-list',
  imports: [IconButton, TranslocoPipe],
  template: `
    <div class="list" role="list" data-testid="jump-list">
      @for (entry of entries(); track entry.id) {
        <div
          class="entry"
          role="listitem"
          data-testid="jump-list-entry"
          [attr.data-jump-id]="entry.id"
          [attr.aria-label]="'a11y.jumpListEntry' | transloco"
          (pointerdown)="onDown($event)"
          (pointerup)="onUp($event, entry.id)"
          (click)="onTap(entry)"
        >
          <span class="dot" data-testid="jump-list-dot" [style.background]="color(entry)"></span>
          <span data-testid="jump-list-from">{{ entry.fromLabel }}</span>
          <span>{{ arrow }}</span>
          <span data-testid="jump-list-to">{{ entry.toLabel }}</span>
          <span data-testid="jump-list-pass">{{ passPrefix }}{{ entry.pass }}</span>
          <button appIconButton icon="delete" labelKey="delete" data-testid="jump-list-delete" (click)="$event.stopPropagation()" (pressed)="remove(entry.id)"></button>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; }
    .list { display: flex; flex-direction: column; max-height: calc(100% - var(--cm-bar-height) * 2); overflow-y: auto; }
    .entry { display: flex; align-items: center; gap: var(--cm-tab-gap); min-height: var(--cm-touch-target); padding: 0 var(--cm-tab-gap); font-family: monospace; touch-action: pan-y; }
    .dot { flex: none; width: var(--cm-dot); height: var(--cm-dot); border-radius: 50%; }
    .entry button { margin-left: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JumpList {
  private readonly view = inject(OrgViewStore);
  private readonly ui = inject(UiStore);
  protected readonly arrow = TUNABLES.layout.listArrow;
  protected readonly passPrefix = TUNABLES.layout.passPrefix;
  private startX = 0;
  private startY = 0;
  private swiped = false;

  protected readonly entries = computed(() => {
    const doc = this.view.document();
    return doc === null ? [] : jumpListEntries(doc.marks(), doc.bars(), TUNABLES.colors.jumpPalette.length);
  });

  protected color(entry: JumpListEntry): string {
    return TUNABLES.colors.jumpPalette[entry.colorIndex] ?? TUNABLES.colors.accent;
  }

  protected onDown(event: PointerEvent): void {
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.swiped = false;
  }

  protected onUp(event: PointerEvent, id: number): void {
    if (isSwipeLeft(event.clientX - this.startX, event.clientY - this.startY)) {
      this.swiped = true;
      this.remove(id);
    }
  }

  /** The sheet would cover the bar the list scrolls to, so it closes when compact. */
  protected onTap(entry: JumpListEntry): void {
    const doc = this.view.document();
    if (this.swiped || doc === null) {
      return;
    }
    this.view.scrollToJunction(doc.bars(), entry.origin);
    this.ui.select({ kind: 'jump', id: entry.id });
    if (this.ui.sizeClass() === 'compact') {
      this.ui.closePopup();
    }
  }

  protected remove(id: number): void {
    this.view.document()?.removeJump(id);
  }
}
