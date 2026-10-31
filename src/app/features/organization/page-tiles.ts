import { ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, input, untracked } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import { tilesCovering } from '../../core';
import type { Rect, Size } from '../../core';
import type { DocumentStore } from '../../state/document.store';
import { RegionRenderer } from '../../state/region-renderer';
import { Scheduler } from '../../state/scheduler';

interface Tile {
  readonly scale: number;
  readonly rect: Rect;
  readonly canvas: HTMLCanvasElement;
  readonly controller: AbortController;
  done: boolean;
}

const KEY_SEPARATOR = '|';

const intersects = (a: Rect, b: Rect): boolean =>
  Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);

/**
 * Tiles of one page, rendered lazily through the scheduler and bitmap cache (ORG-002, NFR-007, NFR-008).
 * Rects are page-local CSS px at the live scale. Tiles are rendered at the settled scale and shown scaled by
 * live/settled until the zoom settles; old tiles are dropped once the new ones are drawn. Canvases are managed
 * imperatively: no per-tile reactivity.
 */
@Component({
  selector: 'app-page-tiles',
  template: '',
  styles: ':host { position: absolute; inset: 0; overflow: hidden; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageTiles {
  readonly document = input.required<DocumentStore>();
  readonly pageIndex = input.required<number>();
  /** Page size in display space. */
  readonly pageSize = input.required<Size>();
  readonly settledScale = input.required<number>();
  readonly liveScale = input.required<number>();
  /** Part of the page to cover with tiles. */
  readonly visibleRect = input.required<Rect>();
  /** The scroll viewport in the same coordinates; tiles intersecting it are `visible`, the others `prefetch`. */
  readonly viewportRect = input.required<Rect>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly scheduler = inject(Scheduler);
  private readonly regions = inject(RegionRenderer);
  private readonly tiles = new Map<string, Tile>();
  private currentScale = 0;

  constructor() {
    effect(() => {
      const doc = this.document();
      const pageIndex = this.pageIndex();
      const pageSize = this.pageSize();
      const settled = this.settledScale();
      const live = this.liveScale();
      const visible = this.visibleRect();
      const viewport = this.viewportRect();
      untracked(() => this.reconcile(doc, pageIndex, pageSize, settled, live, visible, viewport));
    });
    inject(DestroyRef).onDestroy(() => {
      for (const key of [...this.tiles.keys()]) {
        this.release(key);
      }
    });
  }

  private reconcile(doc: DocumentStore, pageIndex: number, pageSize: Size, settled: number, live: number, visible: Rect, viewport: Rect): void {
    this.currentScale = settled;
    if (settled <= 0 || live <= 0) {
      return;
    }
    const factor = settled / live;
    const toSettled = (r: Rect): Rect => ({ x: r.x * factor, y: r.y * factor, width: r.width * factor, height: r.height * factor });
    const wanted = tilesCovering(toSettled(visible), { width: pageSize.width * settled, height: pageSize.height * settled }, TUNABLES.resources.tileSizePx);
    const viewportSettled = toSettled(viewport);
    const wantedKeys = new Set<string>();
    for (const rect of wanted) {
      const key = this.keyOf(settled, rect);
      wantedKeys.add(key);
      if (!this.tiles.has(key)) {
        this.start(doc, pageIndex, key, settled, rect, intersects(rect, viewportSettled) ? 'visible' : 'prefetch');
      }
    }
    for (const [key, tile] of [...this.tiles]) {
      if (tile.scale === settled && !wantedKeys.has(key)) {
        this.release(key);
      }
    }
    for (const tile of this.tiles.values()) {
      this.place(tile, live);
    }
    this.sweep();
  }

  private keyOf(scale: number, rect: Rect): string {
    return [scale, rect.x, rect.y, rect.width, rect.height].join(KEY_SEPARATOR);
  }

  private start(doc: DocumentStore, pageIndex: number, key: string, scale: number, rect: Rect, cls: 'visible' | 'prefetch'): void {
    const canvas = this.host.ownerDocument.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.visibility = 'hidden';
    canvas.style.pointerEvents = 'none';
    this.host.appendChild(canvas);
    const tile: Tile = { scale, rect, canvas, controller: new AbortController(), done: false };
    this.tiles.set(key, tile);
    const region: Rect = { x: rect.x / scale, y: rect.y / scale, width: rect.width / scale, height: rect.height / scale };
    void this.scheduler
      .submit(
        cls,
        async (taskSignal) => {
          const merged = new AbortController();
          const abort = (): void => merged.abort();
          taskSignal.addEventListener('abort', abort);
          tile.controller.signal.addEventListener('abort', abort);
          try {
            const rendered = await this.regions.renderRegionCached(doc, { pageIndex, region, scale }, merged.signal);
            if (rendered.ok && !merged.signal.aborted) {
              this.draw(tile, rendered.value); // owned by the cache: draw at once, never close
            }
          } finally {
            taskSignal.removeEventListener('abort', abort);
            tile.controller.signal.removeEventListener('abort', abort);
          }
        },
        { viewKey: `${doc.tabId}${KEY_SEPARATOR}org${KEY_SEPARATOR}${scale}` },
      )
      .then(() => {
        tile.done = true;
        this.sweep();
      });
  }

  private draw(tile: Tile, bitmap: ImageBitmap): void {
    if (tile.controller.signal.aborted) {
      return;
    }
    tile.canvas.width = bitmap.width;
    tile.canvas.height = bitmap.height;
    const context = tile.canvas.getContext('2d');
    if (context) {
      context.drawImage(bitmap, 0, 0);
      tile.canvas.style.visibility = 'visible';
    }
  }

  /** CSS box of a tile: its rect scaled from the scale it was rendered at to the live scale. */
  private place(tile: Tile, live: number): void {
    const ratio = live / tile.scale;
    const style = tile.canvas.style;
    style.left = `${tile.rect.x * ratio}px`;
    style.top = `${tile.rect.y * ratio}px`;
    style.width = `${tile.rect.width * ratio}px`;
    style.height = `${tile.rect.height * ratio}px`;
    style.zIndex = tile.scale === this.currentScale ? '1' : '0';
  }

  /** Old-scale tiles go once every tile of the current scale has finished (drawn or failed). */
  private sweep(): void {
    const current = [...this.tiles.values()].filter((t) => t.scale === this.currentScale);
    if (!current.every((t) => t.done)) {
      return;
    }
    for (const [key, tile] of [...this.tiles]) {
      if (tile.scale !== this.currentScale) {
        this.release(key);
      }
    }
  }

  private release(key: string): void {
    const tile = this.tiles.get(key);
    if (!tile) {
      return;
    }
    this.tiles.delete(key);
    tile.controller.abort();
    tile.canvas.width = 0;
    tile.canvas.height = 0;
    tile.canvas.remove();
  }
}
