import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, effect, ElementRef, inject, signal, untracked, viewChild } from '@angular/core';

import type { PdfPageInfo } from '../../ports/pdf-renderer';
import type { DocumentStore } from '../../state/document.store';
import { RegionRenderer } from '../../state/region-renderer';
import { Scheduler } from '../../state/scheduler';
import { SessionStore } from '../../state/session.store';

/**
 * Page 1 of the active document at fit-width, rendered through the scheduler and the bitmap cache.
 * FIL-001, NFR-003, NFR-008
 */
// TEMPORARY(M9): shown outside organization mode until S2 of M9 retires it
@Component({
  selector: 'app-page-preview',
  template: '<canvas #canvas [hidden]="!rendered()" [attr.data-rendered]="rendered()"></canvas>',
  styles: `
    :host { display: block; width: 100%; height: 100%; overflow: auto; }
    canvas { display: block; width: 100%; height: auto; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagePreview {
  private readonly session = inject(SessionStore);
  private readonly scheduler = inject(Scheduler);
  private readonly regions = inject(RegionRenderer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly width = signal(0);
  private latestKey = '';
  protected readonly rendered = signal(false);

  constructor() {
    afterNextRender(() => {
      this.width.set(this.host.clientWidth);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.width.set(this.host.clientWidth));
      observer.observe(this.host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    effect(() => {
      const doc = this.session.activeDocument();
      const info = doc?.pageInfos()[0];
      const width = this.width();
      if (!doc || !info || doc.status() !== 'ready' || width <= 0) {
        this.latestKey = '';
        this.rendered.set(false);
        return;
      }
      untracked(() => void this.render(doc, info, width));
    });
  }

  private async render(doc: DocumentStore, info: PdfPageInfo, width: number): Promise<void> {
    const key = `${doc.tabId}|${width}`;
    this.latestKey = key;
    this.scheduler.setViewKey(key);
    const result = await this.scheduler.submit(
      'visible',
      (signal) =>
        this.regions.renderRegionCached(
          doc,
          { pageIndex: info.pageIndex, region: { x: 0, y: 0, width: info.width, height: info.height }, scale: width / info.width },
          signal,
        ),
      { viewKey: key },
    );
    if (!result.ok || !result.value.ok || this.latestKey !== key) {
      return;
    }
    const bitmap = result.value.value; // owned by the cache: draw, never close
    const canvas = this.canvas().nativeElement;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(bitmap, 0, 0);
      this.rendered.set(true);
    }
  }
}
