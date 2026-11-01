import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { TranslocoPipe } from '@jsverse/transloco';

import { TUNABLES } from '../../../config/tunables';
import type { Bar, Rect } from '../../core';
import { DEVICE_INFO } from '../../ports/device-info';
import { CLOCK } from '../../state/clock';
import type { DocumentStore } from '../../state/document.store';
import { DetectionService } from '../../state/detection.service';
import type { ProvisionalBar } from '../../state/detection-run';
import { OrgViewStore } from '../../state/org-view.store';
import { ResourceGovernor } from '../../state/resource-governor';
import { Scheduler } from '../../state/scheduler';
import { Icon } from '../shell/icon';
import { BarsLayer } from './bars-layer';
import { PageTiles } from './page-tiles';

interface TileJob {
  readonly index: number;
  readonly visible: Rect;
  readonly viewport: Rect;
  /** True for pages in the viewport, false for margin pages (DET-021 only looks at the former). */
  readonly inView: boolean;
}

const KEY_SEPARATOR = '|';
const NO_BARS: readonly never[] = [];

function groupByPage<T extends { readonly pageIndex: number }>(items: readonly T[]): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    groups.set(item.pageIndex, [...(groups.get(item.pageIndex) ?? []), item]);
  }
  return groups;
}

/**
 * Organization mode: the whole PDF as a continuous vertical-scroll viewer on canvas grey (ORG-001).
 * Native scrolling; zoom and scroll position live in the DocumentStore per tab (ORG-006). Page boxes only here;
 * tiles are added by the rendering step.
 */
@Component({
  selector: 'app-organization-viewer',
  imports: [PageTiles, BarsLayer, Icon, TranslocoPipe],
  template: `
    <div #scroller class="scroller" data-testid="org-viewer" (scroll)="onScroll()">
      <div class="sizer" data-testid="org-sizer" [style.width.px]="sizerWidth()" [style.height.px]="sizerHeight()">
        @for (page of layout(); track $index) {
          <div
            class="page"
            [attr.data-testid]="'org-page-' + $index"
            [style.top.px]="page.top + offsetY()"
            [style.left.px]="pageLeft($index)"
            [style.width.px]="page.width"
            [style.height.px]="page.height"
          ></div>
        }
        @for (job of jobs(); track document().tabId + ':' + job.index) {
          <div class="tiles" [style.top.px]="(layout()[job.index]?.top ?? 0) + offsetY()" [style.left.px]="pageLeft(job.index)" [style.width.px]="layout()[job.index]?.width" [style.height.px]="layout()[job.index]?.height">
            <app-page-tiles
              [document]="document()"
              [pageIndex]="job.index"
              [pageSize]="pageSizes()[job.index]!"
              [settledScale]="settledScale()"
              [liveScale]="scale()"
              [visibleRect]="job.visible"
              [viewportRect]="job.viewport"
            />
          </div>
        }
        @for (page of layout(); track $index) {
          <div class="overlay" [style.top.px]="page.top + offsetY()" [style.left.px]="pageLeft($index)" [style.width.px]="page.width" [style.height.px]="page.height">
            <app-bars-layer [bars]="barsOf($index)" [provisionalBars]="provisionalBarsOf($index)" [scale]="scale()" />
            @if (isProcessing($index)) {
              <span class="badge" role="img" [attr.data-testid]="'org-processing-' + $index" [attr.aria-label]="'a11y.processing' | transloco">
                <app-icon name="processing" />
              </span>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; background: var(--cm-canvas-grey); }
    .scroller { width: 100%; height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
    .sizer { position: relative; min-width: 100%; }
    .page { position: absolute; background: var(--cm-paper); }
    .tiles { position: absolute; }
    /* Above the tile canvases: bars and the processing badge of a page (ORG-008, DET-016). */
    .overlay { position: absolute; pointer-events: none; }
    .badge { position: absolute; top: var(--cm-page-badge-inset); right: var(--cm-page-badge-inset); color: var(--cm-icon); display: inline-flex; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationViewer {
  readonly document = input.required<DocumentStore>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly destroyRef = inject(DestroyRef);
  private readonly clock = inject(CLOCK);
  private readonly scheduler = inject(Scheduler);
  private readonly governor = inject(ResourceGovernor);
  private cancelSettle: (() => void) | null = null;
  private settledTab = '';
  private readonly view = inject(OrgViewStore);
  private readonly device = inject(DEVICE_INFO);
  private handledRequest = this.view.scrollRequest()?.seq ?? -1;
  private tween = 0;
  private frame = 0;

  protected readonly pageSizes = this.view.pageSizes;
  protected readonly layout = this.view.layout;
  protected readonly sizerWidth = this.view.sizerWidth;
  protected readonly sizerHeight = this.view.sizerHeight;
  protected readonly offsetY = this.view.offsetY;
  /** ORG-003: scale = fit-width scale of the widest page times the zoom. */
  readonly scale = this.view.scale;
  /** Scale the tiles are rendered at; follows `scale` zoomSettleMs after its last change (ORG-002, NFR-008). */
  protected readonly settledScale = signal(0);

  /** Pages in the viewport plus the margin pages, each with the part to cover with tiles (ORG-002). */
  protected readonly jobs = computed<TileJob[]>(() => {
    const layout = this.layout();
    const viewport = this.view.viewport();
    const scroll = this.document().orgScroll();
    const margin = this.governor.prefetchNeighbors() > 0 ? TUNABLES.resources.orgRenderPagesAround : 0;
    if (this.settledScale() <= 0 || layout.length === 0) {
      return [];
    }
    const local = (index: number): Rect => ({
      x: scroll.x - this.pageLeft(index),
      y: scroll.y - (layout[index]?.top ?? 0) - this.offsetY(),
      width: viewport.width,
      height: viewport.height,
    });
    const clip = (r: Rect, w: number, h: number): Rect | null => {
      const x = Math.max(0, r.x);
      const y = Math.max(0, r.y);
      const width = Math.min(w, r.x + r.width) - x;
      const height = Math.min(h, r.y + r.height) - y;
      return width > 0 && height > 0 ? { x, y, width, height } : null;
    };
    const core: TileJob[] = [];
    layout.forEach((page, index) => {
      const view = local(index);
      const visible = clip(view, page.width, page.height);
      if (visible) {
        core.push({ index, visible, viewport: view, inView: true });
      }
    });
    const first = core[0]?.index;
    const last = core[core.length - 1]?.index;
    if (first === undefined || last === undefined) {
      return [];
    }
    const jobs = [...core];
    for (let offset = 1; offset <= margin; offset++) {
      for (const index of [first - offset, last + offset]) {
        const page = layout[index];
        if (!page) {
          continue;
        }
        const view = local(index);
        // Margin pages: full height, but only the viewport's horizontal range.
        const visible = clip({ ...view, y: 0, height: page.height }, page.width, page.height);
        if (visible) {
          jobs.push({ index, visible, viewport: view, inView: false });
        }
      }
    }
    return jobs.sort((a, b) => a.index - b.index);
  });

  private readonly detection = inject(DetectionService);
  private readonly barsByPage = computed(() => groupByPage<Bar>(this.document().bars()));
  private readonly provisionalByPage = computed(() => groupByPage<ProvisionalBar>(this.document().provisionalBars()));

  protected barsOf(pageIndex: number): readonly Bar[] {
    return this.barsByPage().get(pageIndex) ?? NO_BARS;
  }

  protected provisionalBarsOf(pageIndex: number): readonly ProvisionalBar[] {
    return this.provisionalByPage().get(pageIndex) ?? NO_BARS;
  }

  /** DET-016: a page that is not done or failed shows the processing icon. */
  protected isProcessing(pageIndex: number): boolean {
    const state = this.document().detection.states()[pageIndex];
    return state === 'pending' || state === 'running';
  }

  protected pageLeft(index: number): number {
    return (this.sizerWidth() - (this.layout()[index]?.width ?? 0)) / 2;
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelSettle?.());
    effect(() => {
      const scale = this.scale();
      const tabId = this.document().tabId;
      untracked(() => this.followScale(scale, tabId));
    });
    // DET-021: the first page in view that is still waiting becomes the next page to process.
    effect(() => {
      const doc = this.document();
      const states = doc.detection.states();
      const waiting = this.jobs().find((job) => job.inView && states[job.index] === 'pending');
      if (waiting) {
        untracked(() => this.detection.prioritize(doc, waiting.index));
      }
    });
    afterNextRender(() => {
      const element = this.scroller().nativeElement;
      const measure = (): void => this.view.viewport.set({ width: element.clientWidth, height: element.clientHeight });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.tween);
    });
    // ORG-005: page jumps requested by the controls.
    effect(() => {
      const request = this.view.scrollRequest();
      if (request && request.seq !== this.handledRequest) {
        this.handledRequest = request.seq;
        untracked(() => this.scrollTo(request.top, request.animate));
      }
    });
    // Restore the tab's scroll position once the sizer has its size (tab switch, first layout).
    effect(() => {
      const doc = this.document();
      this.sizerHeight();
      this.sizerWidth();
      const target = untracked(() => doc.orgScroll());
      const element = this.scroller().nativeElement;
      queueMicrotask(() => {
        element.scrollLeft = target.x;
        element.scrollTop = target.y;
      });
    });
  }

  /** Instant, or a short rAF tween (ORG-005: at most `navigation.pageScrollMs`); instant with reduced motion. */
  private scrollTo(top: number, animate: boolean): void {
    const element = this.scroller().nativeElement;
    cancelAnimationFrame(this.tween);
    const from = element.scrollTop;
    if (!animate || this.device.prefersReducedMotion() || from === top) {
      element.scrollTop = top;
      return;
    }
    let start: number | null = null;
    const step = (now: number): void => {
      start ??= now;
      const t = Math.min(1, (now - start) / TUNABLES.navigation.pageScrollMs);
      element.scrollTop = from + (top - from) * (1 - (1 - t) * (1 - t));
      if (t < 1) {
        this.tween = requestAnimationFrame(step);
      }
    };
    this.tween = requestAnimationFrame(step);
  }

  /** First layout and tab changes settle at once; later scale changes wait for the zoom to stop. */
  private followScale(scale: number, tabId: string): void {
    if (scale <= 0) {
      return;
    }
    const settle = (): void => {
      this.cancelSettle = null;
      this.settledTab = tabId;
      this.scheduler.setViewKey([tabId, 'org', scale].join(KEY_SEPARATOR));
      this.settledScale.set(scale);
    };
    this.cancelSettle?.();
    this.cancelSettle = null;
    if (this.settledScale() === 0 || this.settledTab !== tabId) {
      settle();
    } else if (scale !== this.settledScale()) {
      this.cancelSettle = this.clock.schedule(TUNABLES.rendering.zoomSettleMs, settle);
    }
  }

  /** Stores the scroll offset per tab; throttled to animation frames, outside Angular reactivity. */
  protected onScroll(): void {
    if (this.frame) {
      return;
    }
    const doc = this.document();
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const element = this.scroller().nativeElement;
      doc.orgScroll.set({ x: element.scrollLeft, y: element.scrollTop });
    });
  }
}
