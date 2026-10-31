import { effect, inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { bitmapRectToDisplay, fitScaleToPixelCap, nextPageToProcess, pickNext, selectSystemRects } from '../core';
import type { DetectedPage, SchedulerContext } from '../core';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { DETECTION_ENGINE } from '../ports/detection-engine';
import type { PdfDocumentHandle, PdfPageInfo } from '../ports/pdf-renderer';
import { CLOCK } from './clock';
import type { DocumentStore } from './document.store';
import { ResourceGovernor } from './resource-governor';
import { Scheduler } from './scheduler';

type PageOutcome = { readonly kind: 'done'; readonly page: DetectedPage } | { readonly kind: 'failed' } | { readonly kind: 'cancelled' };

/**
 * DET-001, DET-002, DET-003, DET-012, DET-018, DET-020: detects the systems of every page in the background, one page
 * at a time, as scheduler tasks of class 'detection'. Only rectangles are kept (DET-022: runtime memory only).
 */
@Injectable({ providedIn: 'root' })
export class DetectionService {
  private readonly scheduler = inject(Scheduler);
  private readonly engine = inject(DETECTION_ENGINE);
  private readonly governor = inject(ResourceGovernor);
  private readonly lifecycle = inject(APP_LIFECYCLE);
  private readonly clock = inject(CLOCK);
  private readonly runs = new Map<DocumentStore, AbortController>();
  private context!: SchedulerContext;
  private governorPaused = false;
  private contextWaiters: Array<() => void> = [];

  constructor() {
    // DET-017: the scheduler re-evaluates its queue whenever the context changes, so a paused detection resumes without polling.
    // The first call is synchronous: an effect would run too late and let the first page start in the idle default context.
    this.syncContext();
    effect(() => this.syncContext());
  }

  /** DET-001: starts automatically for a ready document (embedded data arrives in M15, until then always). */
  start(doc: DocumentStore): void {
    this.stop(doc);
    doc.detection.reset(doc.pageInfos().length);
    const controller = new AbortController();
    this.runs.set(doc, controller);
    void this.drive(doc, controller.signal);
  }

  /** Aborts the run of a document (tab closed). */
  stop(doc: DocumentStore): void {
    this.runs.get(doc)?.abort();
    this.runs.delete(doc);
  }

  /** DET-021: the viewer shows a pending page; it is processed next. */
  prioritize(doc: DocumentStore, pageIndex: number): void {
    if (doc.detection.states()[pageIndex] === 'pending') {
      doc.detection.priorityPage.set(pageIndex);
    }
  }

  private syncContext(): void {
    this.context = {
      userActive: this.lifecycle.userActive(),
      hidden: !this.lifecycle.visible(),
      batterySaver: TUNABLES.detection.pauseOnBatterySaver ? this.lifecycle.batterySaver() : null,
      strokeInProgress: false,
    };
    // NFR-010: at the heaviest memory pressure detection pauses until the governor level drops. Read here, so the effect tracks it.
    this.governorPaused = this.governor.level() >= TUNABLES.resources.governorMaxLevel;
    this.scheduler.setContext(this.context);
    const waiters = this.contextWaiters;
    this.contextWaiters = [];
    for (const wake of waiters) {
      wake();
    }
  }

  /** Detection may run in the current context (same rule the scheduler applies). */
  private canRun(): boolean {
    return !this.governorPaused && pickNext([{ id: 'detection', cls: 'detection', seq: 0 }], this.context) !== null;
  }

  private async drive(doc: DocumentStore, runSignal: AbortSignal): Promise<void> {
    const run = doc.detection;
    while (!runSignal.aborted && run.states().includes('pending')) {
      // While paused (user active, hidden, battery saver) nothing is queued; a context change wakes the run (no polling).
      if (!this.canRun()) {
        await new Promise<void>((resolve) => this.contextWaiters.push(resolve));
        continue;
      }
      const result = await this.scheduler.submit('detection', (taskSignal) => this.step(doc, AbortSignal.any([taskSignal, runSignal])));
      if (!result.ok) {
        // Cancelled by a visible render (or dropped): give the foreground work room instead of resubmitting in a tight loop.
        await new Promise<void>((resolve) => this.clock.schedule(TUNABLES.detection.cancelRetryDelayMs, resolve));
      }
    }
  }

  /** One scheduler task: picks its page when it starts, so a later `prioritize` still wins. */
  private async step(doc: DocumentStore, signal: AbortSignal): Promise<void> {
    if (!this.canRun()) {
      return; // the level rose after this task was queued: leave the page pending, `drive` waits for the next context change
    }
    const run = doc.detection;
    const pageIndex = nextPageToProcess(run.states(), run.priorityPage());
    if (pageIndex === null) {
      return;
    }
    if (run.priorityPage() === pageIndex) {
      run.priorityPage.set(null);
    }
    run.startedOrder.push(pageIndex);
    run.setState(pageIndex, 'running');
    let outcome: PageOutcome;
    try {
      outcome = await this.processPage(doc, pageIndex, signal);
    } catch {
      outcome = { kind: 'failed' };
    }
    if (outcome.kind === 'done') {
      run.finish(pageIndex, 'done', outcome.page);
    } else if (outcome.kind === 'failed') {
      run.finish(pageIndex, 'failed', null);
    } else {
      run.setState(pageIndex, 'pending');
    }
  }

  /** DET-003, DET-018: render at the level's scale, retry once smaller on out-of-memory/unknown, then give up on the page. */
  private async processPage(doc: DocumentStore, pageIndex: number, signal: AbortSignal): Promise<PageOutcome> {
    const handle = doc.handle();
    const info = doc.pageInfos()[pageIndex];
    if (!handle || !info) {
      return { kind: 'failed' };
    }
    const level = TUNABLES.detection.levels[doc.detection.level()];
    const wanted = level.renderScale * this.governor.renderScaleFactor();
    let scale = fitScaleToPixelCap(info.width, info.height, wanted, TUNABLES.resources.maxCanvasPixels);
    for (let attempt = 0; attempt < 2; attempt++) {
      const rects = await this.extract(handle, info, scale, signal);
      if (rects.ok) {
        const systems = selectSystemRects(
          rects.value.map((r) => bitmapRectToDisplay(r, scale)),
          info.width,
          level,
        );
        return { kind: 'done', page: { pageIndex, width: info.width, height: info.height, systems } };
      }
      if (rects.error === 'cancelled') {
        return { kind: 'cancelled' };
      }
      if (rects.error === 'out-of-memory') {
        this.governor.reportFailure();
      }
      scale *= TUNABLES.detection.retryScaleFactor;
    }
    return { kind: 'failed' };
  }

  private async extract(handle: PdfDocumentHandle, info: PdfPageInfo, scale: number, signal: AbortSignal) {
    const region = { x: 0, y: 0, width: info.width, height: info.height };
    const bitmap = await handle.renderRegion({ pageIndex: info.pageIndex, region, scale }, signal);
    if (!bitmap.ok) {
      return bitmap;
    }
    // DET-020: the engine takes the bitmap and closes it; nothing here keeps it.
    return this.engine.extractComponents(bitmap.value, signal);
  }
}
