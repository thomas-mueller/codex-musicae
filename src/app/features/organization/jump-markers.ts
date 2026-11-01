import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { jumpColorIndex } from '../../core';
import type { Bar, DocMarks, MarkPositions, SystemInfo } from '../../core';
import { Icon } from '../shell/icon';
import { LongPressDirective } from './long-press.directive';
import { jumpLabel } from './mark-labels';

/**
 * One end of a jump on the page (ORG-018). The start sits on the right of the source system, the end on the left of the
 * system after the target junction; both show "<previous> → <next> ×<pass>": the playing-order numbers of the system played
 * before the jump and the one played after it.
 */
export interface JumpMarker {
  readonly jumpId: number;
  readonly role: 'origin' | 'target';
  readonly pageIndex: number;
  /** Vertical extent of the anchor (a system, or a bar for the two junctions that have no system) in page points. */
  readonly y: number;
  readonly height: number;
  /** Playing-order number of the system played before / after the jump; null at the start / end of the order or if never reached. */
  readonly previous: number | null;
  readonly next: number | null;
  /** The junction at the other end; long press scrolls there (ORG-019). */
  readonly otherJunction: number;
  readonly pass: number;
  readonly colorIndex: number;
}

interface Anchor {
  readonly pageIndex: number;
  readonly y: number;
  readonly height: number;
}

/**
 * Markers in jump creation order. Junction j lies below system j and above system j + 1, so a start is anchored at system
 * `origin` and an end at system `target + 1`. A start at junction 0 and an end at junction N have no system and fall back
 * to the first bar of that junction. An end whose anchor does not exist yet (outside the usable prefix) gets no marker.
 */
export function jumpMarkers(
  marks: DocMarks,
  systems: readonly SystemInfo[],
  bars: readonly Bar[],
  paletteSize: number,
  positions: MarkPositions,
): JumpMarker[] {
  const systemCount = systems.length;
  const systemAnchor = (index: number): Anchor | null => {
    const system = systems.find((s) => s.index === index);
    return system === undefined ? null : { pageIndex: system.pageIndex, y: system.box.y, height: system.box.height };
  };
  const barAnchor = (junction: number): Anchor | null => {
    const bar = bars.find((b) => b.junction === junction);
    return bar === undefined ? null : { pageIndex: bar.pageIndex, y: bar.y, height: bar.height };
  };
  return marks.jumps.flatMap((jump) => {
    const colorIndex = jumpColorIndex(jump.id, paletteSize);
    const start = systemAnchor(jump.origin) ?? (jump.origin === 0 ? barAnchor(0) : null);
    const end = systemAnchor(jump.target + 1) ?? (jump.target === systemCount ? barAnchor(systemCount) : null);
    const around = positions.jumps.get(jump.id);
    const numbers = { previous: around?.previous ?? null, next: around?.next ?? null };
    const markers: JumpMarker[] = [];
    if (start !== null) {
      markers.push({ ...start, ...numbers, jumpId: jump.id, role: 'origin', otherJunction: jump.target, pass: jump.pass, colorIndex });
    }
    if (end !== null) {
      markers.push({ ...end, ...numbers, jumpId: jump.id, role: 'target', otherJunction: jump.origin, pass: jump.pass, colorIndex });
    }
    return markers;
  });
}

interface MarkerGroup {
  readonly key: string;
  readonly role: 'origin' | 'target';
  readonly y: number;
  readonly height: number;
  readonly markers: readonly JumpMarker[];
}

/**
 * ORG-018..ORG-020: the markers of one page, each group vertically centered on its anchor, at the right page edge (starts)
 * or the left one (ends), side by side starting at that edge. Tap selects the jump, a long press scrolls to the other end.
 */
@Component({
  selector: 'app-jump-markers',
  imports: [Icon, LongPressDirective],
  template: `
    @for (group of groups(); track group.key) {
      <div
        class="group"
        [class.start]="group.role === 'origin'"
        [class.end]="group.role === 'target'"
        [style.top.px]="group.y * scale()"
        [style.height.px]="group.height * scale()"
      >
        @for (marker of group.markers; track marker.jumpId) {
          <button
            type="button"
            class="marker"
            appLongPress
            #press="appLongPress"
            data-marker
            data-testid="jump-marker"
            [attr.data-jump-id]="marker.jumpId"
            [attr.data-role]="marker.role"
            [class.selected]="marker.jumpId === selectedJumpId()"
            [style.background]="color(marker)"
            (click)="onClick($event, marker, press.consumeClick())"
            (longPress)="markerLongPress.emit(marker)"
          >
            <app-icon class="icon" [name]="marker.role === 'origin' ? 'jump' : 'jumpEnd'" />
            <span data-testid="jump-marker-label">{{ label(marker) }}</span>
          </button>
        }
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .group { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: var(--cm-badge-gap); padding: 0 var(--cm-badge-gap); pointer-events: none; --cm-icon-size: var(--cm-bar-row-icon); }
    .group.start { flex-direction: row-reverse; }
    .group.end { flex-direction: row; }
    .marker { display: inline-flex; align-items: center; gap: var(--cm-badge-gap); padding: var(--cm-badge-padding); border: 0; border-radius: var(--cm-badge-radius); color: var(--cm-on-accent); font-family: monospace; font-size: var(--cm-badge-font); cursor: pointer; pointer-events: auto; }
    .marker.selected { outline: var(--cm-break-line-px) solid var(--cm-icon); }
    /* The split points toward the end of the PDF, the merge arrows come from its beginning. */
    .icon { transform: rotate(var(--cm-marker-rotation)); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JumpMarkers {
  readonly markers = input<readonly JumpMarker[]>([]);
  readonly scale = input.required<number>();
  readonly selectedJumpId = input<number | null>(null);
  readonly markerTap = output<number>();
  readonly markerLongPress = output<JumpMarker>();

  protected readonly groups = computed<MarkerGroup[]>(() => {
    const groups = new Map<string, { role: JumpMarker['role']; y: number; height: number; markers: JumpMarker[] }>();
    for (const marker of this.markers()) {
      const key = `${marker.role}|${marker.y}|${marker.height}`;
      const group = groups.get(key) ?? { role: marker.role, y: marker.y, height: marker.height, markers: [] };
      group.markers.push(marker);
      groups.set(key, group);
    }
    return [...groups].map(([key, group]) => ({ key, ...group }));
  });

  protected label(marker: JumpMarker): string {
    return jumpLabel(marker.previous, marker.next, marker.pass);
  }

  protected color(marker: JumpMarker): string {
    return TUNABLES.colors.jumpPalette[marker.colorIndex] ?? TUNABLES.colors.accent;
  }

  protected onClick(event: Event, marker: JumpMarker, longPressed: boolean): void {
    event.stopPropagation();
    if (!longPressed) {
      this.markerTap.emit(marker.jumpId);
    }
  }
}
