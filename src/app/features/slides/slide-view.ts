import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import { composeSlide, fitScale, fitScaleToPixelCap, tilesCovering } from '../../core';
import type { Rect, Size, SlideComposition, SlideContent, SlidePlan, ViewState } from '../../core';
import { DEVICE_INFO } from '../../ports/device-info';
import { CLOCK } from '../../state/clock';
import type { DocumentStore } from '../../state/document.store';
import { RegionRenderer } from '../../state/region-renderer';
import { ResourceGovernor } from '../../state/resource-governor';
import { Scheduler } from '../../state/scheduler';
import { SlideNavStore } from '../../state/slide-nav.store';
import { Icon } from '../shell/icon';
import { TooltipDirective } from '../shell/tooltip.directive';
import { drawComposition } from './draw-composition';
import { tileComposition } from './tile-composition';

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
    <div #slide class="slide" data-testid="slide" [hidden]="composition() === null">
      <canvas #canvas data-testid="slide-canvas"></canvas>
      <div #tiles class="tiles" data-testid="slide-tiles"></div>
    </div>
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
    .slide { position: relative; flex: none; transform-origin: center; }
    canvas { display: block; }
    .tiles { position: absolute; inset: 0; pointer-events: none; }
    .tiles canvas { position: absolute; }
    .empty { display: inline-flex; color: var(--cm-on-canvas, inherit); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideView {
  readonly document = input.required<DocumentStore>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly slideElement = viewChild.required<ElementRef<HTMLElement>>('slide');
  private readonly tilesElement = viewChild.required<ElementRef<HTMLElement>>('tiles');
  private readonly scheduler = inject(Scheduler);
  private readonly regions = inject(RegionRenderer);
  private readonly governor = inject(ResourceGovernor);
  private readonly device = inject(DEVICE_INFO);
  private readonly clock = inject(CLOCK);
  private readonly nav = inject(SlideNavStore);
  private controller: AbortController | null = null;
  private generation = 0;
  private tileController: AbortController | null = null;
  private tileGeneration = 0;
  private cancelSettle: (() => void) | null = null;

  private readonly plan = computed<SlidePlan | null>(() => {
    const doc = this.document();
    return doc.slides()[doc.currentSlideIndex()] ?? null;
  });
  private readonly pageSizes = computed(() => this.document().pageInfos().map((p) => ({ width: p.width, height: p.height })));
  /** SLD-007..SLD-009 */
  protected readonly composition = computed(
    () => {
      const plan = this.plan();
      return plan ? composeSlide(plan, this.document().geoms(), this.pageSizes()) : null;
    },
    // Detection results of other pages recompute it without changing it; a render would cancel the running detection task.
    { equal: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );
  /** SLD-010, SLD-011: CSS px per slide unit; equal for all normal slides because their width is equal. */
  private readonly displayScale = computed(() => {
    const plan = this.plan();
    const stage = this.nav.stage();
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
    // SLD-018: the view is a CSS transform at once; the sharp tiles follow once it has settled.
    effect(() => {
      const { zoom, panX, panY } = this.document().slideView();
      this.slideElement().nativeElement.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    });
    effect(() => {
      const doc = this.document();
      const view = doc.slideView();
      const composition = this.composition();
      const scale = this.displayScale();
      const stage = this.nav.stage();
      untracked(() => this.scheduleTiles(doc, view, composition, scale, stage));
    });
    afterNextRender(() => {
      const measure = (): void => this.nav.stage.set({ width: this.host.clientWidth, height: this.host.clientHeight });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(measure);
        observer.observe(this.host);
        inject(DestroyRef).onDestroy(() => observer.disconnect());
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.cancelSettle?.();
      this.controller?.abort();
      this.tileController?.abort();
    });
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
    const width = `${composition.width * scale}px`;
    const height = `${composition.height * scale}px`;
    canvas.style.width = width;
    canvas.style.height = height;
    this.slideElement().nativeElement.style.width = width;
    this.slideElement().nativeElement.style.height = height;
    const context = canvas.getContext('2d');
    if (context) {
      drawComposition(context, composition, bitmaps, pxPerUnit);
    }
  }

  /** NFR-003, NFR-004: warm the cache for the neighbors; without a view key, because those would be dropped as stale. */
  private prefetch(doc: DocumentStore, index: number, signal: AbortSignal): void {
    const stage = this.nav.stage();
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

  private scheduleTiles(doc: DocumentStore, view: ViewState, composition: SlideComposition | null, scale: number, stage: Size): void {
    this.cancelSettle?.();
    this.cancelSettle = null;
    this.tileController?.abort(); // NFR-008: tiles made for another view are stale
    this.tileController = null;
    ++this.tileGeneration;
    if (view.zoom <= 1 || !composition || scale <= 0) {
      this.tilesElement().nativeElement.replaceChildren();
      return;
    }
    this.cancelSettle = this.clock.schedule(TUNABLES.rendering.zoomSettleMs, () => {
      this.cancelSettle = null;
      this.renderTiles(doc, view, composition, scale, stage);
    });
  }

  /** SLD-018, NFR-007: only the visible part of the zoomed slide, in tiles of at most `tileSizePx`; they replace the stretched part together. */
  private renderTiles(doc: DocumentStore, view: ViewState, composition: SlideComposition, scale: number, stage: Size): void {
    const zoomed = { width: composition.width * scale * view.zoom, height: composition.height * scale * view.zoom };
    const left = stage.width / 2 + view.panX - zoomed.width / 2;
    const top = stage.height / 2 + view.panY - zoomed.height / 2;
    const x0 = Math.max(0, -left);
    const y0 = Math.max(0, -top);
    const x1 = Math.min(zoomed.width, stage.width - left);
    const y1 = Math.min(zoomed.height, stage.height - top);
    if (x1 <= x0 || y1 <= y0) {
      return;
    }
    const controller = new AbortController();
    this.tileController = controller;
    const generation = this.tileGeneration;
    const zoomedScale = scale * view.zoom;
    const viewKey = [doc.tabId, 'slide', doc.currentSlideIndex(), scale, 'zoom', view.zoom, generation].join(KEY_SEPARATOR);
    this.scheduler.setViewKey(viewKey);
    const jobs = tilesCovering({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, zoomed, TUNABLES.resources.tileSizePx).map(async (tile) => {
      const units: Rect = { x: tile.x / zoomedScale, y: tile.y / zoomedScale, width: tile.width / zoomedScale, height: tile.height / zoomedScale };
      const part = tileComposition(composition, units);
      const bitmaps = await Promise.all(part.contents.map((c) => this.fetchPiece(doc, c, zoomedScale, 'visible', controller.signal, viewKey)));
      return { units, part, bitmaps };
    });
    void Promise.all(jobs).then((tiles) => {
      if (generation !== this.tileGeneration || controller.signal.aborted) {
        return;
      }
      const layer = this.tilesElement().nativeElement;
      const dpr = Math.min(this.device.devicePixelRatio(), TUNABLES.resources.devicePixelRatioCap);
      const canvases = tiles.map(({ units, part, bitmaps }) => {
        const canvas = layer.ownerDocument.createElement('canvas');
        const pxPerUnit = fitScaleToPixelCap(part.width, part.height, zoomedScale * dpr, TUNABLES.resources.maxCanvasPixels);
        canvas.width = Math.max(1, Math.round(part.width * pxPerUnit));
        canvas.height = Math.max(1, Math.round(part.height * pxPerUnit));
        // CSS size in fitted-slide px: the wrapper's scale(zoom) makes it zoom-sharp.
        canvas.style.left = `${units.x * scale}px`;
        canvas.style.top = `${units.y * scale}px`;
        canvas.style.width = `${units.width * scale}px`;
        canvas.style.height = `${units.height * scale}px`;
        const context = canvas.getContext('2d');
        if (context) {
          drawComposition(context, part, bitmaps, pxPerUnit);
        }
        return canvas;
      });
      layer.replaceChildren(...canvases);
    });
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
