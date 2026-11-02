import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { barsOfJunction, fitScale, layoutPages, orgZoomLimits, pageAtOffset, scrollAfterZoom } from '../core';
import type { Bar, Point, Size } from '../core';
import type { DocumentStore } from './document.store';
import { SessionStore } from './session.store';
import { UiStore } from './ui.store';

/** A request for the viewer to scroll vertically to `top`; `seq` makes equal requests distinct. */
export interface ScrollRequest {
  readonly top: number;
  readonly animate: boolean;
  readonly seq: number;
}

/**
 * Organization-mode view of the active document: layout, scale, current page and zoom limits as `computed()`
 * over `core/view`, shared by the viewer and the bottom bar (ORG-001, ORG-003, ORG-004, ORG-005).
 * The methods are what the commands Next, Previous and Zoom call until the command bus exists (M13).
 */
@Injectable({ providedIn: 'root' })
export class OrgViewStore {
  private readonly session = inject(SessionStore);
  private readonly ui = inject(UiStore);
  private readonly requestSignal = signal<ScrollRequest | null>(null);
  private seq = 0;

  /** Size of the scroll container, reported by the viewer. */
  readonly viewport = signal<Size>({ width: 0, height: 0 });
  readonly scrollRequest = this.requestSignal.asReadonly();

  readonly document = computed(() => {
    const doc = this.session.activeDocument();
    return doc?.status() === 'ready' ? doc : null;
  });
  /** Controls act only in organization mode with a ready tab. */
  readonly active = computed(() => this.ui.mode() === 'organization' && this.document() !== null);

  /** DET-014: the level of the results on display (the active run), not of a re-run still in progress. */
  readonly level = computed(() => this.document()?.detection.level() ?? TUNABLES.detection.defaultLevel);

  readonly pageSizes = computed<Size[]>(() =>
    (this.document()?.pageInfos() ?? []).map((info) => ({ width: info.width, height: info.height })),
  );
  readonly pageCount = computed(() => this.pageSizes().length);
  readonly widest = computed<Size>(() =>
    this.pageSizes().reduce((best, size) => (size.width > best.width ? size : best), { width: 0, height: 0 }),
  );
  /** Zoom limits relative to fit-width (core contract). */
  private readonly limitsFromFitWidth = computed(() => orgZoomLimits(this.widest(), this.viewport(), TUNABLES.zoom.max));
  /** ORG-003: the zoom value 1 means fit-page (or fit-width, per `zoom.orgDefault`); this is that zoom relative to fit-width. */
  private readonly zoomBase = computed(() => (TUNABLES.zoom.orgDefault === 'fitPage' ? this.limitsFromFitWidth().min : 1));
  /** ORG-003: fit-width scale of the widest page times the zoom base times the zoom. */
  readonly scale = computed(() => {
    const doc = this.document();
    return doc ? this.scaleOf(doc) : 0;
  });
  readonly layout = computed(() => layoutPages(this.pageSizes(), this.scale(), TUNABLES.rendering.orgPageGapPx));
  /** Extent of all pages. */
  readonly pagesWidth = computed(() => this.widest().width * this.scale());
  readonly pagesHeight = computed(() => {
    const layout = this.layout();
    const last = layout[layout.length - 1];
    return last ? last.top + last.height : 0;
  });
  /** ORG-001: content smaller than the viewport is centered; these are the scrollable extent and the vertical shift. */
  readonly sizerWidth = computed(() => Math.max(this.pagesWidth(), this.viewport().width));
  readonly sizerHeight = computed(() => Math.max(this.pagesHeight(), this.viewport().height));
  readonly offsetY = computed(() => Math.max(0, (this.viewport().height - this.pagesHeight()) / 2));

  /** ORG-004: index of the page covering the viewport center; -1 without pages. */
  readonly currentPage = computed(() => {
    const scroll = this.document()?.orgScroll();
    if (!scroll) {
      return -1;
    }
    return pageAtOffset(this.layout(), scroll.y + this.viewport().height / 2, TUNABLES.rendering.orgPageGapPx);
  });
  /** Limits of the zoom value (1 = default fit); the maximum stays `zoom.max` times the fit-width scale. */
  readonly zoomLimits = computed(() => {
    const { min, max } = this.limitsFromFitWidth();
    const base = this.zoomBase();
    return { min: min / base, max: max / base };
  });
  readonly canPrevious = computed(() => this.active() && this.currentPage() > 0);
  readonly canNext = computed(() => this.active() && this.currentPage() >= 0 && this.currentPage() < this.pageCount() - 1);
  readonly canZoomOut = computed(() => this.active() && (this.document()?.orgZoom() ?? 0) > this.zoomLimits().min);
  readonly canZoomIn = computed(() => this.active() && (this.document()?.orgZoom() ?? 0) < this.zoomLimits().max);

  constructor() {
    // FIL-014: the stored position is applied as soon as the viewer has measured itself and the layout exists.
    effect(() => {
      const doc = this.document();
      const restore = doc?.orgRestore();
      const layout = this.layout();
      const scale = this.scale();
      if (!doc || !restore || layout.length === 0 || scale <= 0) {
        return;
      }
      untracked(() => {
        const page = layout[Math.min(Math.max(0, restore.page), layout.length - 1)];
        if (!page) {
          return;
        }
        const top = page.top + restore.offset * scale;
        doc.orgRestore.set(null);
        doc.orgScroll.update((scroll) => ({ x: scroll.x, y: top }));
        this.requestSignal.set({ top, animate: false, seq: this.seq++ });
      });
    });
  }

  /** ORG-003: the display scale of `doc` at the current viewport; 0 while the viewer is unmeasured. */
  scaleOf(doc: DocumentStore): number {
    const sizes = doc.pageInfos().map((info) => ({ width: info.width, height: info.height }));
    const widest = sizes.reduce((best, size) => (size.width > best.width ? size : best), { width: 0, height: 0 });
    const viewport = this.viewport();
    if (widest.width <= 0 || viewport.width <= 0) {
      return 0;
    }
    const base = TUNABLES.zoom.orgDefault === 'fitPage' ? orgZoomLimits(widest, viewport, TUNABLES.zoom.max).min : 1;
    return fitScale(widest, viewport, 'width') * base * doc.orgZoom();
  }

  /**
   * FIL-014: where `doc` is scrolled to, as the page at the top of the viewport and the display-space distance (page points)
   * below that page's top. Null while the viewer is unmeasured.
   */
  anchorOf(doc: DocumentStore): { readonly page: number; readonly offset: number } | null {
    const scale = this.scaleOf(doc);
    const sizes = doc.pageInfos().map((info) => ({ width: info.width, height: info.height }));
    const layout = layoutPages(sizes, scale, TUNABLES.rendering.orgPageGapPx);
    if (scale <= 0 || layout.length === 0) {
      return null;
    }
    const y = doc.orgScroll().y;
    const index = pageAtOffset(layout, y, TUNABLES.rendering.orgPageGapPx);
    const page = layout[Math.max(0, index)];
    return page ? { page: Math.max(0, index), offset: Math.max(0, (y - page.top) / scale) } : null;
  }

  /** ORG-005: scroll to the top of page `index` (clamped). */
  goToPage(index: number, animate: boolean): void {
    const page = this.layout()[Math.max(0, Math.min(index, this.pageCount() - 1))];
    if (!this.active() || !page) {
      return;
    }
    this.requestSignal.set({ top: page.top, animate, seq: this.seq++ });
  }

  /**
   * ORG-019: animated scroll that centers the first bar of `junction` (the bottom bar of the earlier page for a
   * page-change junction). The viewer clamps the offset to the scrollable range.
   */
  scrollToJunction(bars: readonly Bar[], junction: number): void {
    const bar = barsOfJunction(bars, junction)[0];
    const page = bar === undefined ? undefined : this.layout()[bar.pageIndex];
    if (!this.active() || bar === undefined || page === undefined) {
      return;
    }
    const height = Math.max(bar.height * this.scale(), TUNABLES.colors.orgBar.minHeightPx);
    const top = page.top + this.offsetY() + bar.y * this.scale();
    this.requestSignal.set({ top: Math.max(0, top + height / 2 - this.viewport().height / 2), animate: true, seq: this.seq++ });
  }

  next(): void {
    if (this.canNext()) {
      this.goToPage(this.currentPage() + 1, true);
    }
  }

  previous(): void {
    if (this.canPrevious()) {
      this.goToPage(this.currentPage() - 1, true);
    }
  }

  zoomIn(): void {
    this.zoomTo((this.document()?.orgZoom() ?? 1) * TUNABLES.zoom.buttonStep);
  }

  zoomOut(): void {
    this.zoomTo((this.document()?.orgZoom() ?? 1) / TUNABLES.zoom.buttonStep);
  }

  /** Back to the default fit (fit-page). */
  zoomReset(): void {
    this.zoomTo(1);
  }

  /** NAV-013, NAV-014: zoom by `factor`, keeping the content under `anchor` (scroll viewport px) in place. */
  zoomAt(factor: number, anchor: Point): void {
    this.zoomTo((this.document()?.orgZoom() ?? 1) * factor, anchor);
  }

  /** NAV-016: fit-width <-> `doubleTapZoomFactor` x fit-width, around `anchor`. */
  toggleDoubleTapZoom(anchor: Point): void {
    const fitWidthZoom = 1 / this.zoomBase();
    const zoomedIn = (this.document()?.orgZoom() ?? 1) > fitWidthZoom * (1 + TUNABLES.zoom.fitEpsilon);
    this.zoomTo(zoomedIn ? fitWidthZoom : fitWidthZoom * TUNABLES.gestures.doubleTapZoomFactor, anchor);
  }

  /** ORG-003: clamp to the limits and keep the content under `anchor` (default: the viewport center) in place. */
  private zoomTo(target: number, anchor?: Point): void {
    const doc = this.document();
    const viewport = this.viewport();
    if (!doc || !this.active() || viewport.width <= 0) {
      return;
    }
    const { min, max } = this.zoomLimits();
    const next = Math.max(min, Math.min(max, target));
    const old = doc.orgZoom();
    if (next === old) {
      return;
    }
    const scroll = scrollAfterZoom(doc.orgScroll(), anchor ?? { x: viewport.width / 2, y: viewport.height / 2 }, old, next);
    doc.orgZoom.set(next);
    doc.orgScroll.set({ x: Math.max(0, scroll.x), y: Math.max(0, scroll.y) });
  }
}
