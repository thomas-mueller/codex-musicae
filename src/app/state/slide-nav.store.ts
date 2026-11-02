import { computed, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { clampPan, FIT_VIEW, fitScale, zoomAround } from '../core';
import type { Point, Size } from '../core';
import { SessionStore } from './session.store';
import { StrokeGate } from './stroke-gate';
import { UiStore } from './ui.store';

/**
 * Annotation-mode navigation of the active document: current slide, indicator text and the slider. NAV-020, SLD-016
 * A slider drag shows its value at once; the slide itself follows at most once per animation frame.
 */
@Injectable({ providedIn: 'root' })
export class SlideNavStore {
  private readonly session = inject(SessionStore);
  private readonly ui = inject(UiStore);
  private readonly gate = inject(StrokeGate);
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
  /** Size of the area the slide is shown in; reported by `SlideView`. */
  readonly stage = signal<Size>({ width: 0, height: 0 });
  private readonly plan = computed(() => {
    const doc = this.document();
    return doc?.slides()[doc.currentSlideIndex()] ?? null;
  });
  /** SLD-010, SLD-011: CSS px per slide unit that fits the current slide into the stage. */
  readonly displayScale = computed(() => {
    const plan = this.plan();
    const stage = this.stage();
    return plan && stage.width > 0 && stage.height > 0 ? fitScale({ width: plan.width, height: plan.height }, stage, 'contain') : 0;
  });
  /** The slide at zoom 1, in CSS px. */
  readonly fitted = computed<Size>(() => {
    const plan = this.plan();
    const scale = this.displayScale();
    return plan ? { width: plan.width * scale, height: plan.height * scale } : { width: 0, height: 0 };
  });
  readonly view = computed(() => this.document()?.slideView() ?? FIT_VIEW);
  readonly canZoomIn = computed(() => this.active() && this.displayScale() > 0 && this.view().zoom < TUNABLES.zoom.max);
  readonly canZoomOut = computed(() => this.active() && this.view().zoom > TUNABLES.zoom.min);
  readonly canZoomReset = computed(() => this.active() && (this.view().zoom !== FIT_VIEW.zoom || this.view().panX !== 0 || this.view().panY !== 0));
  /** SLD-016: "x / n", "x / n+" while the count may still grow, empty when there is nothing to show. */
  readonly indicatorText = computed(() => {
    const doc = this.document();
    if (!this.active() || !doc || this.count() === 0) {
      return '';
    }
    const open = doc.slideCountIsFinal() ? '' : TUNABLES.layout.indicatorOpenSuffix;
    return `${this.shown() + 1}${TUNABLES.layout.indicatorSeparator}${this.count()}${open}`;
  });

  zoomIn(): void {
    this.zoomBy(TUNABLES.zoom.buttonStep);
  }

  zoomOut(): void {
    this.zoomBy(1 / TUNABLES.zoom.buttonStep);
  }

  zoomReset(): void {
    this.document()?.slideView.set(FIT_VIEW);
  }

  /** SLD-018: the buttons zoom around the stage center. */
  private zoomBy(factor: number): void {
    const stage = this.stage();
    this.zoomAt(factor, { x: stage.width / 2, y: stage.height / 2 });
  }

  /** NAV-013, NAV-014: zoom around `anchor` (stage px), limited to `zoom.min`..`zoom.max`. */
  zoomAt(factor: number, anchor: Point): void {
    const doc = this.document();
    if (doc && this.active() && this.displayScale() > 0) {
      doc.slideView.set(zoomAround(doc.slideView(), factor, anchor, TUNABLES.zoom, this.fitted(), this.stage()));
    }
  }

  /** NAV-012, NAV-014: moves the zoomed slide by (dx, dy) px, kept inside the stage. */
  panBy(dx: number, dy: number): void {
    const doc = this.document();
    if (doc && this.active() && this.displayScale() > 0) {
      const view = doc.slideView();
      doc.slideView.set(clampPan({ ...view, panX: view.panX + dx, panY: view.panY + dy }, this.fitted(), this.stage()));
    }
  }

  /** ANN-013: buttons and slider wait for a stroke in progress, like the navigation commands. */
  previous(): void {
    this.gate.run(() => this.goTo(this.shown() - 1));
  }

  next(): void {
    this.gate.run(() => this.goTo(this.shown() + 1));
  }

  goTo(index: number): void {
    this.cancelFrame();
    this.scrubSignal.set(null);
    this.document()?.goToSlide(index);
  }

  /** Slider `input` event: the display updates now, rendering follows with the next animation frame. */
  scrub(index: number): void {
    this.gate.run(() => this.scrubNow(index));
  }

  private scrubNow(index: number): void {
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
