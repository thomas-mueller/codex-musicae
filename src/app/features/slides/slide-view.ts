import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { composeSlide, fitScale, fitScaleToPixelCap } from '../../core';
import type { SlideContent, SlidePlan } from '../../core';
import { DEVICE_INFO } from '../../ports/device-info';
import type { DocumentStore } from '../../state/document.store';
import { RegionRenderer } from '../../state/region-renderer';
import { ResourceGovernor } from '../../state/resource-governor';
import { Scheduler } from '../../state/scheduler';
import { Icon } from '../shell/icon';
import { TooltipDirective } from '../shell/tooltip.directive';
import { drawComposition } from './draw-composition';

const KEY_SEPARATOR = '|';

/**
 * Annotation mode: the current slide as one canvas, fitted into the stage (SLD-010, SLD-011). The pieces are fetched
 * first and drawn at once, so the previous slide stays visible until the new one is complete. The canvas is managed
 * imperatively; nothing here is per pointer event.
 */
@Component({
  selector: 'app-slide-view',
  imports: [Icon, TooltipDirective, TranslocoPipe],
  template: `
    <canvas #canvas data-testid="slide-canvas" [hidden]="composition() === null"></canvas>
    @if (composition() === null) {
      @if (document().detectionComplete()) {
        <span class="empty" role="img" data-testid="slide-empty-error" [attr.aria-label]="'a11y.noSystems' | transloco" [appTooltip]="'noSystems'">
          <app-icon name="error" />
        </span>
      } @else {
        <span class="empty" role="img" data-testid="slide-empty-processing" [attr.aria-label]="'a11y.processing' | transloco">
          <app-icon name="processing" />
        </span>
      }
    }
  `,
  styles: `
    :host { position: relative; display: flex; width: 100%; height: 100%; align-items: center; justify-content: center; overflow: hidden; }
    canvas { flex: none; }
    .empty { display: inline-flex; color: var(--cm-on-canvas, inherit); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideView {
  readonly document = input.required<DocumentStore>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly scheduler = inject(Scheduler);
  private readonly regions = inject(RegionRenderer);
  private readonly governor = inject(ResourceGovernor);
  private readonly device = inject(DEVICE_INFO);
  private readonly stage = signal({ width: 0, height: 0 });
  private controller: AbortController | null = null;
  private generation = 0;

  private readonly plan = computed<SlidePlan | null>(() => {
    const doc = this.document();
    return doc.slides()[doc.currentSlideIndex()] ?? null;
  });
  private readonly pageSizes = computed(() => this.document().pageInfos().map((p) => ({ width: p.width, height: p.height })));
  /** SLD-007..SLD-009 */
  protected readonly composition = computed(() => {
    const plan = this.plan();
    return plan ? composeSlide(plan, this.document().geoms(), this.pageSizes()) : null;
  });
  /** SLD-010, SLD-011: CSS px per slide unit; equal for all normal slides because their width is equal. */
  private readonly displayScale = computed(() => {
    const plan = this.plan();
    const stage = this.stage();
    return plan && stage.width > 0 && stage.height > 0 ? fitScale({ width: plan.width, height: plan.height }, stage, 'contain') : 0;
  });

  constructor() {
    effect(() => {
      const doc = this.document();
      const composition = this.composition();
      const scale = this.displayScale();
      const index = doc.currentSlideIndex();
      untracked(() => this.render(doc, composition, scale, index));
    });
    afterNextRender(() => {
      const measure = (): void => this.stage.set({ width: this.host.clientWidth, height: this.host.clientHeight });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(measure);
        observer.observe(this.host);
        inject(DestroyRef).onDestroy(() => observer.disconnect());
      }
    });
    inject(DestroyRef).onDestroy(() => this.controller?.abort());
  }

  private render(doc: DocumentStore, composition: ReturnType<SlideView['composition']>, scale: number, index: number): void {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const generation = ++this.generation;
    if (!composition || scale <= 0) {
      return;
    }
    const viewKey = [doc.tabId, 'slide', index, scale].join(KEY_SEPARATOR);
    this.scheduler.setViewKey(viewKey);
    const pieces = composition.contents.map((content) => this.fetchPiece(doc, content, scale, 'visible', controller.signal, viewKey));
    void Promise.all(pieces).then((bitmaps) => {
      if (generation !== this.generation || controller.signal.aborted) {
        return;
      }
      this.paint(composition, bitmaps, scale);
      this.prefetch(doc, index, controller.signal);
    });
  }

  /** The backing store is resized only now: resizing clears a canvas, and the old slide must stay until this one is complete. */
  private paint(composition: NonNullable<ReturnType<SlideView['composition']>>, bitmaps: ReadonlyArray<ImageBitmap | null>, scale: number): void {
    const canvas = this.canvas().nativeElement;
    const dpr = Math.min(this.device.devicePixelRatio(), TUNABLES.resources.devicePixelRatioCap);
    const pxPerUnit = fitScaleToPixelCap(composition.width, composition.height, scale * dpr, TUNABLES.resources.maxCanvasPixels);
    canvas.width = Math.max(1, Math.round(composition.width * pxPerUnit));
    canvas.height = Math.max(1, Math.round(composition.height * pxPerUnit));
    canvas.style.width = `${composition.width * scale}px`;
    canvas.style.height = `${composition.height * scale}px`;
    const context = canvas.getContext('2d');
    if (context) {
      drawComposition(context, composition, bitmaps, pxPerUnit);
    }
  }

  /** NFR-003, NFR-004: warm the cache for the neighbors; without a view key, because those would be dropped as stale. */
  private prefetch(doc: DocumentStore, index: number, signal: AbortSignal): void {
    const stage = this.stage();
    const slides = doc.slides();
    for (let step = 1; step <= this.governor.prefetchNeighbors(); step++) {
      for (const neighbor of [index - step, index + step]) {
        const plan = slides[neighbor];
        if (!plan) {
          continue;
        }
        const scale = fitScale({ width: plan.width, height: plan.height }, stage, 'contain');
        for (const content of composeSlide(plan, doc.geoms(), this.pageSizes()).contents) {
          void this.fetchPiece(doc, content, scale, 'prefetch', signal);
        }
      }
    }
  }

  private async fetchPiece(
    doc: DocumentStore,
    content: SlideContent,
    scale: number,
    cls: 'visible' | 'prefetch',
    signal: AbortSignal,
    viewKey?: string,
  ): Promise<ImageBitmap | null> {
    const result = await this.scheduler.submit(
      cls,
      async (taskSignal) => {
        const merged = new AbortController();
        const abort = (): void => merged.abort();
        taskSignal.addEventListener('abort', abort);
        signal.addEventListener('abort', abort);
        try {
          const rendered = await this.regions.renderRegionCached(doc, { pageIndex: content.pageIndex, region: content.source, scale }, merged.signal);
          return rendered.ok ? rendered.value : null;
        } finally {
          taskSignal.removeEventListener('abort', abort);
          signal.removeEventListener('abort', abort);
        }
      },
      viewKey === undefined ? {} : { viewKey },
    );
    return result.ok ? result.value : null;
  }
}
