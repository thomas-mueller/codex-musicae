import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { FIT_VIEW } from '../core';
import type { SystemRef } from '../core';
import { CrossFileService } from './cross-file.service';
import type { DocumentStore } from './document.store';
import { SessionStore } from './session.store';
import { UiStore } from './ui.store';

/** One jump into another file: where it came from, where it went and what that file's order started at before. */
interface Departure {
  readonly from: string;
  readonly to: string;
  readonly arrivalBefore: SystemRef | null;
}

/**
 * Playing across files: next at the end of an order with a cross-file jump continues at its target, previous at the start of
 * that arrival goes back, one jump at a time. The jumps made are the chain; it ends when the player leaves the playing by
 * choosing a file, closing one or entering organization or settings mode. FIL-051, FIL-052, MRK-016, PLY-017
 */
@Injectable({ providedIn: 'root' })
export class CrossFilePlayback {
  private readonly session = inject(SessionStore);
  private readonly crossFile = inject(CrossFileService);
  private readonly ui = inject(UiStore);
  private readonly chain = signal<readonly Departure[]>([]);

  /** Next at the last slide of the current file leads into another file now. */
  readonly canContinue = computed(() => this.destination() !== null);
  /** Previous at the first slide of the current file leads back. */
  readonly canReturn = computed(() => this.chain().at(-1)?.to === this.session.activeTabId() && this.chain().length > 0);

  private readonly destination = computed(() => {
    const id = this.session.activeTabId();
    const doc = this.session.activeDocument();
    const exit = doc?.status() === 'ready' ? doc.playingOrder().exit : undefined;
    if (id === null || !doc || !exit || doc.slideCount() === 0) {
      return null;
    }
    // MRK-016: while the target is missing or still being read, the order ends here, like at a stop
    const { state, target } = this.crossFile.stateOf(id, exit.to);
    return state === 'resolved' && target ? { from: id, target, to: exit.to } : null;
  });

  constructor() {
    effect(() => {
      const chain = this.chain();
      if (chain.length === 0) {
        return;
      }
      const mode = this.ui.mode();
      const open = new Set(this.session.sessionEntries().map((entry) => entry.id));
      const left =
        mode === 'organization' ||
        mode === 'settings' ||
        this.session.activeTabId() !== chain.at(-1)!.to ||
        chain.some((departure) => !open.has(departure.from) || !open.has(departure.to));
      if (left) {
        untracked(() => this.end());
      }
    });
  }

  /** One page turn in the current file, or from it into the next or previous one. NAV-003: clamped, no wrap. */
  step(direction: 1 | -1): void {
    const doc = this.session.activeDocument();
    if (doc?.status() !== 'ready' || doc.slideCount() === 0) {
      return;
    }
    const index = doc.currentSlideIndex();
    if (direction === 1 && index === doc.slideCount() - 1) {
      this.continue();
    } else if (direction === -1 && index === 0 && this.canReturn()) {
      this.return(doc);
    } else {
      doc.goToSlide(index + direction);
    }
  }

  private continue(): void {
    const destination = this.destination();
    if (!destination) {
      return;
    }
    const { from, target, to } = destination;
    const arrivalBefore = target.document.arrival();
    target.document.arrival.set({ pageIndex: to.pageIndex, system: to.system });
    this.showSlide(target.document, 0);
    this.chain.update((chain) => [...chain, { from, to: target.id, arrivalBefore }]);
    this.session.show(target.id);
  }

  /** Back to the slide the jump was made from: the last one of that file, where its order left it. */
  private return(current: DocumentStore): void {
    const departure = this.chain().at(-1)!;
    const source = this.session.sessionEntries().find((entry) => entry.id === departure.from);
    if (!source) {
      this.end();
      return;
    }
    current.arrival.set(departure.arrivalBefore);
    this.showSlide(source.document, source.document.slideCount() - 1);
    this.chain.update((chain) => chain.slice(0, -1));
    this.session.show(source.id);
  }

  private showSlide(document: DocumentStore, index: number): void {
    document.slideView.set(FIT_VIEW);
    document.goToSlide(index);
  }

  /** Every file shows its own order again. */
  private end(): void {
    this.chain.set([]);
    for (const entry of this.session.sessionEntries()) {
      entry.document.arrival.set(null);
    }
  }
}
