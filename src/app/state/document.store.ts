import { computed, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import {
  EMPTY_MARKS, addJump, clearJunction, computeBars, flattenSystems, forcedBreaks, generatePlayingOrder, isComplete,
  isProvisional, junctionCount, removeJump, systemNumbers, toggleBreak, toggleStop, updateJump, usablePrefix,
} from '../core';
import type { DetectedPage, DocMarks, Jump, Point } from '../core';
import type { PdfDocumentHandle, PdfOpenError, PdfPageInfo, PdfRenderer } from '../ports/pdf-renderer';
import { DetectionRun } from './detection-run';
import type { ProvisionalBar } from './detection-run';

export type DocumentStatus = 'loading' | 'ready' | 'error';
export type DocumentErrorCode = PdfOpenError;

/**
 * One per tab (FIL-005). Holds the pdf.js handle and lightweight page data; later milestones add position,
 * zoom, marks. Never keeps the PDF bytes (FIL-015).
 */
export class DocumentStore {
  private readonly handleSignal = signal<PdfDocumentHandle | null>(null);
  private readonly pageInfosSignal = signal<readonly PdfPageInfo[]>([]);
  private readonly statusSignal = signal<DocumentStatus>('loading');
  private readonly errorCodeSignal = signal<DocumentErrorCode | null>(null);

  /** Status markers of FIL-003; set by later milestones (saving, read-only files, lost access). */
  readonly unsaved = signal(false);
  readonly readOnly = signal(false);
  readonly needsReopen = signal(false);

  /** Organization mode view state, kept per tab (ORG-006): zoom relative to the default fit (fit-page), scroll offset in CSS px. */
  readonly orgZoom = signal(1);
  readonly orgScroll = signal<Point>({ x: 0, y: 0 });

  /** Background detection of this document (M10); filled by `DetectionService`. */
  readonly detection = new DetectionRun();

  /** DET-019: only pages inside the usable prefix feed numbering, slides and interactive bars. */
  readonly pagesUsable = computed<readonly DetectedPage[]>(() => {
    const prefix = usablePrefix(this.detection.states());
    return this.detection
      .pages()
      .slice(0, prefix)
      .filter((p): p is DetectedPage => p !== null);
  });
  readonly systems = computed(() => flattenSystems(this.pagesUsable()));
  readonly junctionCount = computed(() => junctionCount(this.pagesUsable()));
  readonly bars = computed(() => computeBars(this.pagesUsable()));
  /** DET-021: bars of pages that are done but outside the usable prefix, shown dimmed and inert. */
  readonly provisionalBars = computed<readonly ProvisionalBar[]>(() => {
    const states = this.detection.states();
    return this.detection.pages().flatMap((page, i) =>
      page !== null && isProvisional(i, states)
        ? computeBars([page]).map((bar) => ({ ...bar, junction: -1, provisional: true as const }))
        : [],
    );
  });
  /** DET-015: a re-run in the background; the active run above stays displayed until it completes and is adopted. */
  readonly candidate = signal<DetectionRun | null>(null);
  /** DET-016: while a re-run is going on the progress shows the candidate's. */
  readonly detectionProgress = computed(() => {
    const states = (this.candidate() ?? this.detection).states();
    return { done: states.filter((s) => s === 'done' || s === 'failed').length, total: states.length };
  });
  readonly detectionComplete = computed(() => this.candidate() === null && isComplete(this.detection.states()));

  /** ORG-017: jumps, breaks and stops of this tab; in memory only (saving comes in M15). */
  private readonly marksSignal = signal<DocMarks>(EMPTY_MARKS);
  readonly marks = this.marksSignal.asReadonly();
  /** Transient: set to a fresh object on every rejected edit so the UI can flash an error icon; no text. */
  private readonly lastRejectedSignal = signal<{ readonly seq: number } | null>(null);
  readonly lastRejected = this.lastRejectedSignal.asReadonly();
  private rejectedSeq = 0;

  readonly playingOrder = computed(() =>
    generatePlayingOrder({
      systemCount: this.junctionCount(),
      jumps: this.marks().jumps,
      stops: this.marks().stops,
      maxLength: TUNABLES.playingOrder.maxLength,
    }),
  );
  readonly numbers = computed(() => systemNumbers(this.playingOrder(), this.junctionCount()));
  readonly forcedBreakAfter = computed(() => forcedBreaks(this.playingOrder(), new Set(this.marks().breaks)));

  readonly handle = this.handleSignal.asReadonly();
  readonly pageInfos = this.pageInfosSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly errorCode = this.errorCodeSignal.asReadonly();

  constructor(
    readonly tabId: string,
    private readonly renderer: PdfRenderer,
  ) {}

  /** FIL-009: never throws; failures end in status 'error' with a code. */
  async load(bytes: Uint8Array): Promise<void> {
    const opened = await this.renderer.open(bytes);
    if (!opened.ok) {
      this.fail(opened.error);
      return;
    }
    const handle = opened.value;
    const infos: PdfPageInfo[] = [];
    for (let i = 0; i < handle.pageCount; i++) {
      const info = await handle.getPageInfo(i);
      if (!info.ok) {
        await handle.destroy();
        this.fail('unknown');
        return;
      }
      infos.push(info.value);
    }
    this.handleSignal.set(handle);
    this.pageInfosSignal.set(infos);
    this.statusSignal.set('ready');
  }

  /** Returns the id of the new jump, or null if it was rejected. */
  addJump(jump: Jump): number | null {
    const before = this.marks().nextJumpId;
    return this.apply(addJump(this.marks(), jump, this.junctionCount())) ? before : null;
  }

  removeJump(id: number): void {
    this.apply(removeJump(this.marks(), id));
  }

  updateJump(id: number, patch: Partial<Jump>): void {
    this.apply(updateJump(this.marks(), id, patch, this.junctionCount()));
  }

  toggleBreak(junction: number): void {
    this.apply(toggleBreak(this.marks(), junction, this.junctionCount()));
  }

  toggleStop(junction: number): void {
    this.apply(toggleStop(this.marks(), junction, this.junctionCount()));
  }

  clearJunction(junction: number): void {
    this.apply(clearJunction(this.marks(), junction));
  }

  /** DET-015: marks after a re-run (kept or cleared by `reconcileAfterRedetection`); not an edit, so never "rejected". */
  replaceMarks(marks: DocMarks): void {
    this.marksSignal.set(marks);
  }

  clearRejected(): void {
    this.lastRejectedSignal.set(null);
  }

  async dispose(): Promise<void> {
    const handle = this.handleSignal();
    this.handleSignal.set(null);
    await handle?.destroy();
  }

  /** A null result (invalid edit) leaves the marks unchanged and flags the rejection. */
  private apply(next: DocMarks | null): boolean {
    if (next === null) {
      this.lastRejectedSignal.set({ seq: ++this.rejectedSeq });
      return false;
    }
    this.marksSignal.set(next);
    return true;
  }

  private fail(code: DocumentErrorCode): void {
    this.errorCodeSignal.set(code);
    this.statusSignal.set('error');
  }
}
