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

import { TUNABLES } from '../../../config/tunables';
import { fitScale, layoutPages } from '../../core';
import type { Size } from '../../core';
import type { DocumentStore } from '../../state/document.store';

/**
 * Organization mode: the whole PDF as a continuous vertical-scroll viewer on canvas grey (ORG-001).
 * Native scrolling; zoom and scroll position live in the DocumentStore per tab (ORG-006). Page boxes only here;
 * tiles are added by the rendering step.
 */
@Component({
  selector: 'app-organization-viewer',
  template: `
    <div #scroller class="scroller" data-testid="org-viewer" (scroll)="onScroll()">
      <div class="sizer" data-testid="org-sizer" [style.width.px]="sizerWidth()" [style.height.px]="sizerHeight()">
        @for (page of layout(); track $index) {
          <div
            class="page"
            [attr.data-testid]="'org-page-' + $index"
            [style.top.px]="page.top"
            [style.left.px]="(sizerWidth() - page.width) / 2"
            [style.width.px]="page.width"
            [style.height.px]="page.height"
          ></div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; background: var(--cm-canvas-grey); }
    .scroller { width: 100%; height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
    .sizer { position: relative; min-width: 100%; }
    .page { position: absolute; background: var(--cm-paper); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationViewer {
  readonly document = input.required<DocumentStore>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewport = signal<Size>({ width: 0, height: 0 });
  private frame = 0;

  private readonly pageSizes = computed<Size[]>(() =>
    this.document()
      .pageInfos()
      .map((info) => ({ width: info.width, height: info.height })),
  );
  private readonly widest = computed<Size>(() =>
    this.pageSizes().reduce((best, size) => (size.width > best.width ? size : best), { width: 0, height: 0 }),
  );
  /** ORG-003: scale = fit-width scale of the widest page times the zoom. */
  readonly scale = computed(() => {
    const widest = this.widest();
    const viewport = this.viewport();
    if (widest.width <= 0 || viewport.width <= 0) {
      return 0;
    }
    return fitScale(widest, viewport, 'width') * this.document().orgZoom();
  });
  protected readonly layout = computed(() => layoutPages(this.pageSizes(), this.scale(), TUNABLES.rendering.orgPageGapPx));
  protected readonly sizerWidth = computed(() => this.widest().width * this.scale());
  protected readonly sizerHeight = computed(() => {
    const layout = this.layout();
    const last = layout[layout.length - 1];
    return last ? last.top + last.height : 0;
  });

  constructor() {
    afterNextRender(() => {
      const element = this.scroller().nativeElement;
      const measure = (): void => this.viewport.set({ width: element.clientWidth, height: element.clientHeight });
      measure();
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }
    });
    this.destroyRef.onDestroy(() => cancelAnimationFrame(this.frame));
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
