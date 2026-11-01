import { computed, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { SessionStore } from './session.store';
import { UiStore } from './ui.store';

/**
 * Annotation-mode navigation of the active document: current slide, indicator text and the slider. NAV-020, SLD-016
 * A slider drag shows its value at once; the slide itself follows at most once per animation frame.
 */
@Injectable({ providedIn: 'root' })
export class SlideNavStore {
  private readonly session = inject(SessionStore);
  private readonly ui = inject(UiStore);
  private readonly scrubSignal = signal<number | null>(null);
  private frame: number | null = null;

  readonly document = computed(() => {
    const doc = this.session.activeDocument();
    return doc?.status() === 'ready' ? doc : null;
  });
  /** Controls act only in annotation mode with a ready tab. */
  readonly active = computed(() => this.ui.mode() === 'annotation' && this.document() !== null);
  readonly count = computed(() => this.document()?.slideCount() ?? 0);
  /** The slide on display, or the one the slider is being dragged to. */
  readonly shown = computed(() => this.scrubSignal() ?? this.document()?.currentSlideIndex() ?? 0);
  readonly canPrevious = computed(() => this.active() && this.count() > 0 && this.shown() > 0);
  readonly canNext = computed(() => this.active() && this.shown() < this.count() - 1);
  readonly canSlide = computed(() => this.active() && this.count() > 0);
  /** SLD-016: "x / n", "x / n+" while the count may still grow, empty when there is nothing to show. */
  readonly indicatorText = computed(() => {
    const doc = this.document();
    if (!this.active() || !doc || this.count() === 0) {
      return '';
    }
    const open = doc.slideCountIsFinal() ? '' : TUNABLES.layout.indicatorOpenSuffix;
    return `${this.shown() + 1}${TUNABLES.layout.indicatorSeparator}${this.count()}${open}`;
  });

  previous(): void {
    this.goTo(this.shown() - 1);
  }

  next(): void {
    this.goTo(this.shown() + 1);
  }

  goTo(index: number): void {
    this.cancelFrame();
    this.scrubSignal.set(null);
    this.document()?.goToSlide(index);
  }

  /** Slider `input` event: the display updates now, rendering follows with the next animation frame. */
  scrub(index: number): void {
    if (!this.canSlide()) {
      return;
    }
    this.scrubSignal.set(Math.min(Math.max(0, index), this.count() - 1));
    if (this.frame === null) {
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        const target = this.scrubSignal();
        this.scrubSignal.set(null);
        if (target !== null) {
          this.document()?.goToSlide(target);
        }
      });
    }
  }

  private cancelFrame(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }
}
