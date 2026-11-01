import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import type { DocumentStore } from '../../state/document.store';
import { CLOCK } from '../../state/clock';
import { SlideView } from '../slides/slide-view';
import { presentationProgress } from './progress';

/** Presentation mode: only the slide stage and a thin progress line. The cursor hides while idle. UIX-009, UIX-019, UIX-020 */
@Component({
  selector: 'app-presentation-view',
  imports: [SlideView],
  template: `
    <app-slide-view [document]="document()" />
    @if (progress() !== null) {
      <div class="progress" data-testid="progress-line" [style.width.%]="(progress() ?? 0) * 100"></div>
    }
  `,
  styles: `
    :host { position: relative; display: block; width: 100%; height: 100%; }
    :host(.cursor-hidden) { cursor: none; }
    .progress {
      position: absolute; left: 0; bottom: 0; box-sizing: content-box; pointer-events: none;
      height: var(--cm-progress-line-height); background: var(--cm-progress-line);
      padding-bottom: env(safe-area-inset-bottom);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.cursor-hidden]': 'cursorHidden()',
    '(pointermove)': 'onMove()',
  },
})
export class PresentationView {
  readonly document = input.required<DocumentStore>();

  private readonly clock = inject(CLOCK);
  private cancelHide: (() => void) | null = null;
  protected readonly cursorHidden = signal(false);
  protected readonly progress = computed(() => presentationProgress(this.document().currentSlideIndex(), this.document().slideCount()));

  constructor() {
    this.armTimer();
    inject(DestroyRef).onDestroy(() => this.cancelHide?.());
  }

  protected onMove(): void {
    this.cursorHidden.set(false);
    this.armTimer();
  }

  private armTimer(): void {
    this.cancelHide?.();
    this.cancelHide = this.clock.schedule(TUNABLES.layout.cursorHideMs, () => this.cursorHidden.set(true));
  }
}
