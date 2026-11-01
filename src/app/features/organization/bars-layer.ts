import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import type { Bar } from '../../core';
import type { ProvisionalBar } from '../../state/detection-run';

/**
 * ORG-008, ORG-010, DET-021: the junction bars of one page as translucent full-width strips over the whitespace gaps.
 * Positions are `bar.y × scale` (page-local CSS px). Bars do not take pointer events yet; interaction comes in M11.
 */
@Component({
  selector: 'app-bars-layer',
  template: `
    @for (bar of bars(); track $index) {
      <div
        class="bar"
        data-testid="org-bar"
        [class.selected]="bar.junction === selectedJunction()"
        [style.top.px]="bar.y * scale()"
        [style.height.px]="heightOf(bar)"
      ></div>
    }
    @for (bar of provisionalBars(); track $index) {
      <div
        class="bar provisional"
        data-testid="org-bar-provisional"
        [style.top.px]="bar.y * scale()"
        [style.height.px]="heightOf(bar)"
      ></div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; pointer-events: none; }
    .bar { position: absolute; left: 0; width: 100%; background: var(--cm-org-bar-tint); opacity: var(--cm-org-bar-opacity); pointer-events: none; }
    .bar.selected { opacity: var(--cm-org-bar-selected-opacity); }
    .bar.provisional { opacity: var(--cm-org-bar-provisional-opacity); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarsLayer {
  readonly bars = input<readonly Bar[]>([]);
  readonly provisionalBars = input<readonly ProvisionalBar[]>([]);
  readonly scale = input.required<number>();
  /** The highlighted junction; both bars of a page change are highlighted because both carry its number. */
  readonly selectedJunction = input<number | null>(null);

  protected heightOf(bar: Bar): number {
    return Math.max(bar.height * this.scale(), TUNABLES.colors.orgBar.minHeightPx);
  }
}
