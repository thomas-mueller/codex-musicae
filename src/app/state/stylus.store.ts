import { DestroyRef, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { PEN_INITIAL, reducePen } from '../core';
import type { PenEvent, PenState } from '../core';
import { PREFERENCES } from '../ports/preferences';

const KEYS = { seen: 'stylus.seen', allowFinger: 'stylus.allowFinger' } as const;

/**
 * Stylus knowledge: whether a pen was ever seen (persisted), whether fingers may draw anyway (persisted) and the live
 * pen state for palm rejection. STY-001, STY-003, STY-004
 */
@Injectable({ providedIn: 'root' })
export class StylusStore {
  private readonly preferences = inject(PREFERENCES);
  private readonly seenSignal = signal(false);
  private readonly allowSignal = signal<boolean>(TUNABLES.stylus.allowFingerDrawingDefault);
  private readonly penSignal = signal<PenState>(PEN_INITIAL);
  /** Updated on every pen event; the signal follows at most once per animation frame. */
  private current: PenState = PEN_INITIAL;
  private frame: number | null = null;
  private pending: Promise<void>;

  readonly stylusSeen = this.seenSignal.asReadonly();
  readonly allowFingerDrawing = this.allowSignal.asReadonly();
  /** Mirror of the live pen state for reactive readers. */
  readonly pen = this.penSignal.asReadonly();
  /** Resolves when the stored flags have been read (and queued changes are written). */
  get ready(): Promise<void> {
    return this.pending;
  }

  constructor() {
    this.pending = this.load();
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) {
        cancelAnimationFrame(this.frame);
        this.frame = null;
      }
    });
  }

  /** The live pen state, not reactive; for per-event decisions. */
  penNow(): PenState {
    return this.current;
  }

  /** STY-001: the first pen event persists the flag; later ones change nothing. */
  markSeen(): Promise<void> {
    if (this.seenSignal()) {
      return this.pending;
    }
    this.seenSignal.set(true);
    return this.enqueue(() => this.preferences.set(KEYS.seen, true));
  }

  setAllowFingerDrawing(allow: boolean): Promise<void> {
    this.allowSignal.set(allow);
    return this.enqueue(() => this.preferences.set(KEYS.allowFinger, allow));
  }

  /** Cheap enough for every pointer event: a reduction and, at most once per frame, a signal write. */
  feedPen(event: PenEvent): void {
    this.current = reducePen(this.current, event);
    if (this.frame === null) {
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.penSignal.set(this.current);
      });
    }
  }

  private async load(): Promise<void> {
    const seen = await this.preferences.get<unknown>(KEYS.seen);
    const allow = await this.preferences.get<unknown>(KEYS.allowFinger);
    this.seenSignal.update((v) => v || seen === true);
    this.allowSignal.set(typeof allow === 'boolean' ? allow : TUNABLES.stylus.allowFingerDrawingDefault);
  }

  private enqueue(change: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(change, change);
    return this.pending;
  }
}
