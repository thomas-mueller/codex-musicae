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
import { isValidMarkJunction, junctionHasItems } from '../../core';
import type { Bar, Point, Rect, SystemInfo } from '../../core';
import { DEVICE_INFO } from '../../ports/device-info';
import { CLOCK } from '../../state/clock';
import type { DocumentStore } from '../../state/document.store';
import { DetectionService } from '../../state/detection.service';
import type { ProvisionalBar } from '../../state/detection-run';
import { OrgViewStore } from '../../state/org-view.store';
import { UiStore } from '../../state/ui.store';
import { ResourceGovernor } from '../../state/resource-governor';
import { Scheduler } from '../../state/scheduler';
import { Icon } from '../shell/icon';
import { IconButton } from '../shell/icon-button';
import { BarsLayer } from './bars-layer';
import { barRows } from './bar-rows';
import { chipPlacement } from './chip-placement';
import { JumpMarkers, jumpMarkers } from './jump-markers';
import type { JumpMarker } from './jump-markers';
import { nextPass } from './jump-pass';
import { PassStepper, POPUP_PASS_STEPPER } from './pass-stepper';
import { SelectionChip } from './selection-chip';
import { SystemLabels } from './system-labels';
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
  imports: [PageTiles, BarsLayer, JumpMarkers, SystemLabels, SelectionChip, PassStepper, IconButton, Icon, TranslocoPipe],
  host: { '(document:keydown)': 'onKeydown($event)' },
  template: `
    @if (pickingOrigin() !== null) {
      <div class="hint" role="status" data-testid="org-hint-bar" [attr.aria-label]="'a11y.hintBar' | transloco">
        <button appIconButton icon="cancel" labelKey="cancel" data-testid="org-hint-cancel" (pressed)="ui.cancelPicking()"></button>
      </div>
    }
    <div #scroller class="scroller" data-testid="org-viewer" (scroll)="onScroll()" (click)="onBackgroundClick($event)">
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
            <app-system-labels [systems]="systemsOf($index)" [numbers]="document().numbers()" [scale]="scale()" />
            <app-bars-layer [bars]="barsOf($index)" [provisionalBars]="provisionalBarsOf($index)" [scale]="scale()" [rows]="rows()" [selectedJunction]="selectedJunction()" [pickingOrigin]="pickingOrigin()" (barTap)="selectJunction($event)" />
            <app-jump-markers [markers]="markersOf($index)" [scale]="scale()" [selectedJumpId]="selectedJumpId()" (markerTap)="selectJump($event)" (markerLongPress)="onMarkerLongPress($event)" />
            @if (isProcessing($index)) {
              <span class="badge" role="img" [attr.data-testid]="'org-processing-' + $index" [attr.aria-label]="'a11y.processing' | transloco">
                <app-icon name="processing" />
              </span>
            }
          </div>
        }
        @let chip = chipState();
        @if (chip) {
          <app-selection-chip
            class="chip"
            [style.left.px]="chip.position.x"
            [style.top.px]="chip.position.y"
            [kind]="chip.kind"
            [markable]="chip.markable"
            [hasBreak]="chip.hasBreak"
            [hasStop]="chip.hasStop"
            [hasItems]="chip.hasItems"
            (toggleBreak)="document().toggleBreak(chip.junction)"
            (toggleStop)="document().toggleStop(chip.junction)"
            (clear)="onClear(chip)"
            (jump)="onJump(chip.junction)"
            (openPass)="ui.openPopup(passStepperId)"
            (changeTarget)="onChangeTarget(chip.jumpId)"
          />
        }
        @let stepper = stepperState();
        @if (stepper) {
          <app-pass-stepper
            class="chip"
            [style.left.px]="stepper.position.x"
            [style.top.px]="stepper.position.y"
            [pass]="stepper.pass"
            (passChange)="document().updateJump(stepper.id, { pass: $event })"
          />
        }
      </div>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; width: 100%; height: 100%; background: var(--cm-canvas-grey); }
    /* ORG-015: its own row above the scroller, so it never covers the first bar. */
    .hint { flex: none; display: flex; justify-content: flex-end; align-items: center; min-height: var(--cm-hint-bar-height); background: var(--cm-accent); color: var(--cm-on-accent); }
    .hint button { color: var(--cm-on-accent); }
    .scroller { width: 100%; flex: 1 1 0; min-height: 0; overflow: auto; -webkit-overflow-scrolling: touch; }
    .sizer { position: relative; min-width: 100%; }
    .page { position: absolute; background: var(--cm-paper); }
    .tiles { position: absolute; }
    /* Above the tile canvases: bars and the processing badge of a page (ORG-008, DET-016). */
    /* z-index: the tile canvases use 0 and 1, so the overlay (bars, badges) needs 2 to paint above them. */
    .overlay { position: absolute; z-index: 2; pointer-events: none; }
    .chip { position: absolute; z-index: 3; }
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

  protected readonly ui = inject(UiStore);
  protected readonly passStepperId = POPUP_PASS_STEPPER;
  private readonly detection = inject(DetectionService);
  protected readonly rows = computed(() => {
    const doc = this.document();
    return barRows(doc.marks(), doc.junctionCount());
  });
  /** ORG-013: the selected junction while it still exists. */
  protected readonly selectedJunction = computed(() => {
    const selection = this.ui.selection();
    return selection?.kind === 'junction' && selection.junction <= this.document().junctionCount() ? selection.junction : null;
  });
  private readonly markers = computed(() =>
    jumpMarkers(this.document().marks(), this.document().systems(), this.document().bars(), TUNABLES.colors.jumpPalette.length),
  );
  private readonly markersByPage = computed(() => groupByPage<JumpMarker>(this.markers()));
  protected readonly pickingOrigin = computed(() => this.ui.pickingTarget()?.originJunction ?? null);
  /** ORG-020: the selected jump while it exists. */
  private readonly selectedJump = computed(() => {
    const selection = this.ui.selection();
    return selection?.kind === 'jump' ? (this.document().marks().jumps.find((j) => j.id === selection.id) ?? null) : null;
  });
  protected readonly selectedJumpId = computed(() => this.selectedJump()?.id ?? null);
  private readonly stepperOpen = computed(() => this.ui.popup()?.id === POPUP_PASS_STEPPER && this.selectedJump() !== null);

  /** Top-left of a floating control of `size` next to a vertical extent of a page (page points; content coordinates out). */
  private placeNearAnchor(anchor: { pageIndex: number; y: number; height: number }, size: { width: number; height: number }): Point | null {
    const page = this.layout()[anchor.pageIndex];
    if (page === undefined) {
      return null;
    }
    const scroll = this.document().orgScroll();
    const rect: Rect = {
      x: this.pageLeft(anchor.pageIndex),
      y: page.top + this.offsetY() + anchor.y * this.scale(),
      width: page.width,
      height: Math.max(anchor.height * this.scale(), TUNABLES.colors.orgBar.minHeightPx),
    };
    return chipPlacement(rect, size, { x: scroll.x, y: scroll.y, ...this.view.viewport() }, TUNABLES.layout.chipGapPx);
  }

  /** Next to the first bar of `junction`. */
  private placeNear(junction: number, size: { width: number; height: number }): Point | null {
    const bar = this.document().bars().find((b) => b.junction === junction);
    return bar === undefined ? null : this.placeNearAnchor(bar, size);
  }

  /** ORG-020: next to the start marker of a jump (its source system), else next to the origin bar. */
  private placeNearJump(jumpId: number, origin: number, size: { width: number; height: number }): Point | null {
    const marker = this.markers().find((m) => m.jumpId === jumpId && m.role === 'origin');
    return marker === undefined ? this.placeNear(origin, size) : this.placeNearAnchor(marker, size);
  }

  /** ORG-014, ORG-020: chip of the selected junction, or of the selected jump (next to its start marker). */
  protected readonly chipState = computed(() => {
    if (this.ui.pickingTarget() !== null || this.stepperOpen()) {
      return null;
    }
    const doc = this.document();
    const marks = doc.marks();
    const { minTouchTargetPx, chipPaddingPx, chipMaxButtons, jumpChipButtons } = TUNABLES.layout;
    const height = minTouchTargetPx + 2 * chipPaddingPx;
    const jump = this.selectedJump();
    if (jump !== null) {
      const position = this.placeNearJump(jump.id, jump.origin, { width: jumpChipButtons * minTouchTargetPx + 2 * chipPaddingPx, height });
      return position === null
        ? null
        : { kind: 'jump' as const, junction: jump.origin, jumpId: jump.id, position, hasItems: true, hasBreak: false, hasStop: false, markable: false };
    }
    const junction = this.selectedJunction();
    if (junction === null) {
      return null;
    }
    const hasItems = junctionHasItems(marks, junction);
    const buttons = hasItems ? chipMaxButtons : chipMaxButtons - 1;
    const position = this.placeNear(junction, { width: buttons * minTouchTargetPx + 2 * chipPaddingPx, height });
    return position === null
      ? null
      : {
          kind: 'junction' as const,
          junction,
          jumpId: 0,
          position,
          hasItems,
          hasBreak: marks.breaks.includes(junction),
          hasStop: marks.stops.includes(junction),
          markable: isValidMarkJunction(junction, doc.junctionCount()),
        };
  });
  /** ORG-016: the pass stepper, anchored at the origin bar of the selected jump. */
  protected readonly stepperState = computed(() => {
    const jump = this.selectedJump();
    if (jump === null || !this.stepperOpen()) {
      return null;
    }
    const { minTouchTargetPx, chipPaddingPx, jumpChipButtons } = TUNABLES.layout;
    const size = { width: jumpChipButtons * minTouchTargetPx + 2 * chipPaddingPx, height: minTouchTargetPx + 2 * chipPaddingPx };
    const position = this.placeNearJump(jump.id, jump.origin, size);
    return position === null ? null : { id: jump.id, pass: jump.pass, position };
  });
  private readonly systemsByPage = computed(() => groupByPage<SystemInfo>(this.document().systems()));
  private readonly barsByPage = computed(() => groupByPage<Bar>(this.document().bars()));
  private readonly provisionalByPage = computed(() => groupByPage<ProvisionalBar>(this.document().provisionalBars()));

  /** ORG-013 selects; while a target is picked (ORG-015) the tap creates or retargets the jump instead. */
  protected selectJunction(junction: number): void {
    const picking = this.ui.pickingTarget();
    if (picking === null) {
      this.ui.select({ kind: 'junction', junction });
      return;
    }
    if (junction === picking.originJunction) {
      return;
    }
    const doc = this.document();
    if (picking.editJumpId !== undefined) {
      doc.updateJump(picking.editJumpId, { target: junction });
      this.ui.cancelPicking();
      return;
    }
    const pass = nextPass(doc.marks(), picking.originJunction);
    const id = doc.addJump({ origin: picking.originJunction, target: junction, pass });
    if (id !== null) {
      this.ui.cancelPicking();
      this.ui.select({ kind: 'jump', id });
      this.ui.openPopup(POPUP_PASS_STEPPER);
    }
  }

  /** ORG-020 */
  protected selectJump(id: number): void {
    if (this.ui.pickingTarget() === null) {
      this.ui.closePopup();
      this.ui.select({ kind: 'jump', id });
    }
  }

  /** ORG-019: long press scrolls to the other end of the jump. */
  protected onMarkerLongPress(marker: JumpMarker): void {
    this.view.scrollToJunction(this.document().bars(), marker.otherJunction);
  }

  protected onClear(chip: { kind: 'junction' | 'jump'; junction: number; jumpId: number }): void {
    if (chip.kind === 'jump') {
      this.document().removeJump(chip.jumpId);
      this.ui.deselect();
    } else {
      this.document().clearJunction(chip.junction);
    }
  }

  protected onChangeTarget(jumpId: number): void {
    const jump = this.document().marks().jumps.find((j) => j.id === jumpId);
    if (jump !== undefined) {
      this.ui.startPicking({ originJunction: jump.origin, editJumpId: jumpId });
    }
  }

  /** ORG-013: tapping empty space (outside bars, the chip and the pass stepper) deselects. */
  protected onBackgroundClick(event: MouseEvent): void {
    if (!(event.target instanceof Element) || event.target.closest('[data-bar],[data-chip],[data-popup]') === null) {
      this.ui.deselect();
    }
  }

  // TODO(M13): Escape and back arrive as semantic commands from input/; local until then.
  protected onKeydown(event: KeyboardEvent): void {
    if (!(TUNABLES.keymap.back as readonly string[]).includes(event.code)) {
      return;
    }
    if (this.ui.pickingTarget() !== null) {
      this.ui.cancelPicking();
    } else if (this.ui.selection() !== null) {
      this.ui.deselect();
    }
  }

  /** ORG-015: the other bars become targets. */
  protected onJump(originJunction: number): void {
    this.ui.startPicking({ originJunction });
  }

  protected markersOf(pageIndex: number): readonly JumpMarker[] {
    return this.markersByPage().get(pageIndex) ?? NO_BARS;
  }

  protected systemsOf(pageIndex: number): readonly SystemInfo[] {
    return this.systemsByPage().get(pageIndex) ?? NO_BARS;
  }

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
    // The selection belongs to one tab's bars.
    effect(() => {
      const tabId = this.document().tabId;
      untracked(() => {
        if (tabId) {
          this.ui.deselect();
          this.ui.cancelPicking();
        }
      });
    });
    // A selected jump that was deleted (or cleared with its junction) is no longer selected.
    effect(() => {
      const selection = this.ui.selection();
      const exists = selection?.kind === 'jump' && this.selectedJump() !== null;
      if (selection?.kind === 'jump' && !exists) {
        untracked(() => {
          this.ui.deselect();
          if (this.ui.popup()?.id === POPUP_PASS_STEPPER) {
            this.ui.closePopup(); // other popups (the jump list) stay open
          }
        });
      }
    });
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
