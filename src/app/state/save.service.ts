import { computed, effect, signal, untracked } from '@angular/core';
import type { EffectRef, Injector } from '@angular/core';
import type { Subscription } from 'rxjs';

import { SAVE_INITIAL, reduceSave, saveDecision } from '../core';
import type { SaveEvent, SaveState } from '../core';
import type { Clock } from './clock';
import type { DocChange, DocumentStore } from './document.store';

/**
 * Writes the document; resolves to true when the file now holds the current state, to false when saving failed, and to
 * 'readOnly' when the file turned out not to be writable and to 'needsAccess' when the browser has to ask the user first (in both
 * cases the changes stay unsaved, without an error). Supplied by the save pipeline.
 */
type SaveRunner = (signal: AbortSignal) => Promise<boolean | 'readOnly' | 'needsAccess'>;

interface SaveHooks {
  /** FIL-034: asked before every autosave; false means that nothing may be written now. */
  readonly permit?: () => Promise<boolean>;
  /** FIL-039: a file that cannot be written has changes that a save would be due for. */
  readonly onUnwritable?: () => void;
}

/**
 * SAV-008, SAV-009, FIL-010: one per tab. Feeds the pure autosave state machine with the tab's changes, arms the idle
 * timer and starts saves through the runner. Read-only tabs never save by themselves.
 */
export class SaveService {
  private readonly state = signal<SaveState>(SAVE_INITIAL);
  readonly dirty = computed(() => this.state().dirty);
  readonly saving = computed(() => this.state().saving);
  readonly failed = computed(() => this.state().failed);

  private cancelTimer: (() => void) | null = null;
  private current: Promise<void> | null = null;
  private abort: AbortController | null = null;
  private disposed = false;
  private readonly subscription: Subscription;
  private readonly effects: EffectRef[];
  /** Each watcher forgets its baseline here, so the next run only records the current value again. */
  private readonly baselineResets: Array<() => void> = [];

  constructor(
    private readonly doc: DocumentStore,
    private readonly clock: Clock,
    private readonly run: SaveRunner,
    private readonly idleMs: number,
    injector: Injector,
    /** EDN-001: false in the free edition: changes stay in memory and are never saved (the modified marker still shows). */
    private readonly saveEnabled = true,
    private readonly hooks: SaveHooks = {},
  ) {
    this.subscription = doc.changes.subscribe((change) => this.onDocChange(change));
    this.effects = [
      this.watch(() => doc.systemMarks(), injector),
      this.watch(() => doc.ratioOverride(), injector),
      this.watchDetectionCompletion(injector),
    ];
  }

  /**
   * Saves now (tab switch, close, pause). Resolves to false when the save failed; a read-only tab or a clean one
   * resolves to true at once.
   */
  async force(): Promise<boolean> {
    if (this.disposed) {
      return true;
    }
    this.dispatch({ type: 'force' });
    this.evaluate();
    while (this.current !== null) {
      await this.current;
    }
    return !this.failed();
  }

  /** The overwrite question was answered with yes: the waiting changes are saved now. */
  resume(): void {
    this.doc.saveHeld.set(false);
    this.dispatch({ type: 'force' });
    this.evaluate();
  }

  /**
   * "Save as new file" (FIL-037): runs `runner` as the save of this moment, whatever the state of the autosave. Changes
   * made while it runs stay unsaved. Resolves to false when it failed.
   */
  async saveNow(runner: (signal: AbortSignal) => Promise<boolean>): Promise<boolean> {
    while (this.current !== null) {
      await this.current;
    }
    this.cancelTimer?.();
    this.cancelTimer = null;
    let saved = false;
    const run = async (): Promise<void> => {
      this.dispatch({ type: 'force' }); // clears an earlier failure
      this.dispatch({ type: 'saveStarted' });
      const abort = new AbortController();
      this.abort = abort;
      saved = await runner(abort.signal).catch(() => false);
      this.abort = null;
      this.dispatch({ type: 'saveFinished', ok: saved, t: this.clock.now() });
    };
    this.current = run();
    await this.current;
    this.current = null;
    this.evaluate();
    return saved;
  }

  /**
   * SAV-005, DET-023: restoring saved data on open is no edit. Called after hydration and loading ink: the watchers take a
   * fresh baseline at their next run (whichever order effects and hydration happened in) and the state machine starts clean.
   * A detection that is started afterwards and completes still counts as a change (SAV-012).
   */
  rebaseline(): void {
    this.baselineResets.forEach((reset) => reset());
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.state.set(SAVE_INITIAL);
    this.doc.unsaved.set(false);
    this.doc.saveFailed.set(false);
  }

  dispose(): void {
    this.disposed = true;
    this.subscription.unsubscribe();
    this.effects.forEach((e) => e.destroy());
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.abort?.abort();
  }

  private onDocChange(change: DocChange): void {
    switch (change.type) {
      case 'strokeStart':
        this.dispatch({ type: 'strokeStart' });
        break;
      case 'strokeEnd':
        this.dispatch({ type: 'strokeEnd', t: change.t });
        break;
      case 'change':
        this.dispatch({ type: 'change', t: change.t });
        break;
    }
    this.evaluate();
  }

  /** The first run only takes the baseline, so restoring saved data on open is no change. */
  private watch(read: () => unknown, injector: Injector): EffectRef {
    let first = true;
    this.baselineResets.push(() => (first = true));
    return effect(
      () => {
        read();
        if (first) {
          first = false;
          return;
        }
        untracked(() => this.markChanged());
      },
      { injector },
    );
  }

  private watchDetectionCompletion(injector: Injector): EffectRef {
    let previous: boolean | null = null;
    this.baselineResets.push(() => (previous = null));
    return effect(
      () => {
        const complete = this.doc.detectionComplete();
        const finished = previous === false && complete;
        previous = complete;
        // SAV-012: only a file that can be written has something to save after detection
        if (finished && this.saveEnabled && !untracked(() => this.doc.readOnly())) {
          untracked(() => this.markChanged());
        }
      },
      { injector },
    );
  }

  private markChanged(): void {
    this.dispatch({ type: 'change', t: this.clock.now() });
    this.evaluate();
  }

  private dispatch(event: SaveEvent): void {
    const next = reduceSave(this.state(), event);
    this.state.set(next);
    this.doc.unsaved.set(next.dirty && !next.failed);
    this.doc.saveFailed.set(next.failed);
  }

  private evaluate(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
    if (this.disposed || !this.saveEnabled) {
      return;
    }
    if (this.doc.readOnly()) {
      if (this.state().dirty && !this.state().strokeInProgress) {
        this.hooks.onUnwritable?.();
      }
      return;
    }
    if (this.doc.needsWriteAccess() || this.doc.saveHeld()) {
      return;
    }
    const now = this.clock.now();
    const decision = saveDecision(this.state(), now, this.idleMs);
    if (decision.action === 'wait') {
      this.cancelTimer = this.clock.schedule(decision.until - now, () => {
        this.cancelTimer = null;
        this.evaluate();
      });
    } else if (decision.action === 'save' && this.current === null) {
      this.current = this.startSave();
    }
  }

  private async startSave(): Promise<void> {
    if (this.hooks.permit) {
      // FIL-034: asked before the save counts as started, so the modified marker stays while the user has not answered
      const permitted = await this.hooks.permit().catch(() => false);
      if (this.disposed || !permitted || this.state().strokeInProgress) {
        if (!permitted) {
          this.doc.saveHeld.set(true);
        }
        this.current = null; // the end of a stroke evaluates again
        return;
      }
    }
    this.dispatch({ type: 'saveStarted' });
    const abort = new AbortController();
    this.abort = abort;
    const outcome = await this.run(abort.signal).catch(() => false);
    this.abort = null;
    this.dispatch({ type: 'saveFinished', ok: outcome !== false, t: this.clock.now() });
    if (outcome === 'readOnly' || outcome === 'needsAccess') {
      this.dispatch({ type: 'change', t: this.clock.now() });
    }
    this.current = null;
    this.evaluate();
  }
}
