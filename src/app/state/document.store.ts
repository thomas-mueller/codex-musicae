import { computed, linkedSignal, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import {
  EMPTY_MARKS, addJump, clearJunction, computeBars, computePaddings, findEntryForSystem, flattenSystems, forcedBreaks,
  generatePlayingOrder, isComplete, isProvisional, junctionCount, markPositions, packSlides, paddedArea,
  referenceWidth, removeJump, slideIndexOfEntry, systemNumbers, toggleBreak, toggleStop, updateJump, usablePrefix,
} from '../core';
import type { DetectedPage, DocMarks, Jump, Orientation, Point, SlidePlan, SystemGeom } from '../core';
import type { PdfDocumentHandle, PdfOpenError, PdfPageInfo, PdfRenderer } from '../ports/pdf-renderer';
import { DetectionRun } from './detection-run';
import { NO_RATIO_DEFAULTS } from './ratio-defaults';
import type { RatioDefaults } from './ratio-defaults';
import type { ProvisionalBar } from './detection-run';

export type DocumentStatus = 'loading' | 'ready' | 'error';
export type DocumentErrorCode = PdfOpenError;
/** SLD-012: `entry` = index into the playing order of the first entry on the current slide, `system` = that entry's system. */
export interface SlidePosition {
  readonly entry: number;
  readonly system: number;
}
/** SLD-015: per-PDF aspect-ratio overrides, in memory (saving comes in M15). */
export type RatioOverride = { readonly [O in Orientation]?: number };

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
  /** ORG-018, ORG-021: where jumps, breaks and stops are met in the playing order (playing-order numbers, never print numbers). */
  readonly markPositions = computed(() => markPositions(this.marks(), this.junctionCount(), TUNABLES.playingOrder.maxLength));

  /** DET-010: padding per usable page, in the order of `pagesUsable`. */
  readonly paddings = computed(() => computePaddings(this.pagesUsable(), TUNABLES.detection.fallbackPaddingPageHeightRatio));
  /** Systems with their padded areas; the padding is matched to a system's page by `pageIndex`, never by position. */
  readonly geoms = computed<readonly SystemGeom[]>(() => {
    const pages = this.pagesUsable();
    const paddings = this.paddings();
    const slotOf = new Map(pages.map((page, slot) => [page.pageIndex, slot]));
    return this.systems().flatMap((system) => {
      const slot = slotOf.get(system.pageIndex);
      const page = slot === undefined ? undefined : pages[slot];
      const padding = slot === undefined ? undefined : paddings[slot];
      return page && padding !== undefined
        ? [{ index: system.index, pageIndex: system.pageIndex, box: system.box, padded: paddedArea(system.box, padding, page) }]
        : [];
    });
  });
  /** SLD-002 */
  readonly slideWidth = computed(() => referenceWidth(this.geoms()));

  /** SLD-014, SLD-015: override beats the global default beats the screen ratio. */
  readonly ratioOverride = signal<RatioOverride>({});
  readonly orientation = computed(() => this.ratioDefaults.orientation());
  readonly aspectRatio = computed(() => {
    const orientation = this.orientation();
    return (
      this.ratioOverride()[orientation] ?? this.ratioDefaults.globalRatio(orientation) ?? this.ratioDefaults.screenRatio(orientation)
    );
  });

  /** SLD-003; no systems (or an unusable ratio) means no slides. */
  readonly slides = computed<readonly SlidePlan[]>(() => {
    const geoms = this.geoms();
    const slideWidth = this.slideWidth();
    if (geoms.length === 0 || slideWidth <= 0) {
      return [];
    }
    return packSlides({
      entries: this.playingOrder().entries,
      forcedBreakAfter: this.forcedBreakAfter(),
      systems: geoms,
      slideWidth,
      aspectRatio: this.aspectRatio(),
    });
  });
  readonly slideCount = computed(() => this.slides().length);
  /** SLD-016: shown as "n+" until detection is complete. */
  readonly slideCountIsFinal = computed(() => this.detectionComplete());

  /**
   * SLD-012: follows the system, not the entry, when the playing order changes; a new ratio or orientation leaves the entries
   * (and so the entry) untouched.
   */
  private readonly positionSignal = linkedSignal<readonly number[], SlidePosition>({
    source: () => this.playingOrder().entries,
    computation: (entries, previous) => {
      if (!previous) {
        return { entry: 0, system: entries[0] ?? 1 };
      }
      const entry = findEntryForSystem(entries, previous.value.system);
      return { entry: Math.max(0, entry), system: previous.value.system };
    },
  });
  readonly position = this.positionSignal.asReadonly();
  readonly currentSlideIndex = computed(() => Math.max(0, slideIndexOfEntry(this.slides(), this.position().entry)));

  /** NAV-020: clamps to the existing slides; the position becomes the slide's first entry. */
  goToSlide(index: number): void {
    const slides = this.slides();
    const slide = slides[Math.min(Math.max(0, Math.trunc(index)), slides.length - 1)];
    const system = slide ? this.playingOrder().entries[slide.entryStart] : undefined;
    if (slide && system !== undefined) {
      this.positionSignal.set({ entry: slide.entryStart, system });
    }
  }

  readonly handle = this.handleSignal.asReadonly();
  readonly pageInfos = this.pageInfosSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly errorCode = this.errorCodeSignal.asReadonly();

  constructor(
    readonly tabId: string,
    private readonly renderer: PdfRenderer,
    private readonly ratioDefaults: RatioDefaults = NO_RATIO_DEFAULTS,
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
