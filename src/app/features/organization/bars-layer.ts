import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import type { Bar } from '../../core';
import type { ProvisionalBar } from '../../state/detection-run';
import { Icon } from '../shell/icon';
import type { BarRowData } from './bar-rows';

/**
 * ORG-008, ORG-010, DET-021: the junction bars of one page as translucent full-width strips over the whitespace gaps.
 * Positions are `bar.y × scale` (page-local CSS px). Tapping a bar emits its junction (ORG-013); provisional bars are inert.
 * ORG-011: each bar carries a row overlay (break line and scissors, stop) that never affects layout.
 */
@Component({
  selector: 'app-bars-layer',
  imports: [Icon],
  template: `
    @for (bar of bars(); track $index) {
      <div
        class="bar"
        data-bar
        data-testid="org-bar"
        [class.selected]="bar.junction === selectedJunction()"
        [class.target]="pickingOrigin() !== null && bar.junction !== pickingOrigin()"
        [style.top.px]="bar.y * scale()"
        [style.height.px]="heightOf(bar)"
        (click)="barTap.emit(bar.junction)"
      >
        @let row = rows().get(bar.junction);
        @if (row && (row.hasBreak || row.hasStop)) {
          <div class="row" data-testid="org-bar-row">
            @if (row.hasBreak) {
              <span class="break-line" data-testid="org-bar-break-line"></span>
              <span class="break-icon" data-testid="org-bar-break-icon"><app-icon name="slideBreak" /></span>
            }
            @if (row.hasStop) {
              <span class="stop-icon" data-testid="org-bar-stop-icon"><app-icon name="stop" /></span>
            }
          </div>
        }
      </div>
    }
    @for (bar of provisionalBars(); track $index) {
      <div
        class="bar provisional"
        data-bar
        data-testid="org-bar-provisional"
        [style.top.px]="bar.y * scale()"
        [style.height.px]="heightOf(bar)"
      ></div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .bar { position: absolute; left: 0; width: 100%; pointer-events: auto; }
    /* The tint is a pseudo element so that the row on top keeps full opacity; the slop makes thin bars tappable. */
    .bar::before { content: ''; position: absolute; inset: 0; background: var(--cm-org-bar-tint); opacity: var(--cm-org-bar-opacity); }
    .bar::after { content: ''; position: absolute; left: 0; right: 0; top: calc(-1 * var(--cm-bar-hit-slop)); bottom: calc(-1 * var(--cm-bar-hit-slop)); }
    .bar.selected::before { opacity: var(--cm-org-bar-selected-opacity); }
    .bar.provisional { pointer-events: none; }
    .bar.provisional::before { opacity: var(--cm-org-bar-provisional-opacity); }
    .bar.target::before { opacity: var(--cm-org-bar-selected-opacity); }
    .row { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); z-index: 1; display: flex; align-items: center; gap: var(--cm-bar-row-inset); padding-left: var(--cm-bar-row-inset); pointer-events: none; --cm-icon-size: var(--cm-bar-row-icon); }
    .break-line { position: absolute; left: 0; right: 0; top: 50%; height: var(--cm-break-line-px); transform: translateY(-50%); background: var(--cm-break-line); }
    .break-icon { position: relative; display: inline-flex; color: var(--cm-break-line); }
    .stop-icon { position: relative; display: inline-flex; color: var(--cm-icon); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarsLayer {
  readonly bars = input<readonly Bar[]>([]);
  readonly provisionalBars = input<readonly ProvisionalBar[]>([]);
  readonly scale = input.required<number>();
  /** The highlighted junction; both bars of a page change are highlighted. */
  readonly selectedJunction = input<number | null>(null);
  /** Row content per junction (ORG-011); junctions without an entry show no row. */
  readonly rows = input<ReadonlyMap<number, BarRowData>>(new Map());
  /** ORG-015: while a target is picked, the origin junction (all other bars are highlighted); null otherwise. */
  readonly pickingOrigin = input<number | null>(null);
  readonly barTap = output<number>();

  protected heightOf(bar: Bar): number {
    return Math.max(bar.height * this.scale(), TUNABLES.colors.orgBar.minHeightPx);
  }
}
