import { inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef } from '../ports/file-access';
import { PREFERENCES } from '../ports/preferences';
import type { Orientation } from '../core';

const KEY_RECENT = 'recent';
const KEY_RATIO = { portrait: 'ratio.portrait', landscape: 'ratio.landscape' } as const;

export type GlobalRatios = { readonly [O in Orientation]?: number };

/** Persisted settings. FIL-008, FIL-015: only `FileRef`s are stored, never bytes or PDF-derived data. */
@Injectable({ providedIn: 'root' })
export class PreferencesStore {
  private readonly preferences = inject(PREFERENCES);
  private readonly files = inject(FILE_ACCESS);
  private readonly recentSignal = signal<readonly FileRef[]>([]);
  private readonly ratiosSignal = signal<GlobalRatios>({});
  private pending: Promise<void>;

  /** Newest first, no duplicates, at most `T:resources.recentFilesMax`. */
  readonly recentFiles = this.recentSignal.asReadonly();
  /** SLD-014: global default aspect ratio per orientation; unset until captured. */
  readonly globalRatios = this.ratiosSignal.asReadonly();
  /** Resolves when the stored list has been read (and queued changes are written). */
  get ready(): Promise<void> {
    return this.pending;
  }

  constructor() {
    this.pending = this.load();
  }

  setGlobalRatio(orientation: Orientation, ratio: number): Promise<void> {
    return this.enqueue(async () => {
      this.ratiosSignal.update((r) => ({ ...r, [orientation]: ratio }));
      await this.preferences.set(KEY_RATIO[orientation], ratio);
    });
  }

  /** `isInUse` protects handles of files that are open in a tab from being forgotten. */
  addRecent(ref: FileRef, isInUse: (id: string) => boolean = () => false): Promise<void> {
    return this.enqueue(async () => {
      const current = this.recentSignal();
      let existing: FileRef | undefined;
      for (const candidate of current) {
        if (candidate.id === ref.id || (await this.files.isSame(candidate, ref))) {
          existing = candidate;
          break;
        }
      }
      if (existing) {
        if (existing.id !== ref.id && !isInUse(ref.id)) {
          await this.files.forget(ref);
        }
        await this.write([existing, ...current.filter((r) => r !== existing)], isInUse);
        return;
      }
      await this.write([ref, ...current], isInUse);
    });
  }

  removeRecent(ref: FileRef, isInUse: (id: string) => boolean = () => false): Promise<void> {
    return this.enqueue(async () => {
      if (!isInUse(ref.id)) {
        await this.files.forget(ref);
      }
      await this.write(this.recentSignal().filter((r) => r.id !== ref.id), isInUse);
    });
  }

  private async load(): Promise<void> {
    const stored = await this.preferences.get<FileRef[]>(KEY_RECENT);
    this.recentSignal.set(Array.isArray(stored) ? stored.slice(0, TUNABLES.resources.recentFilesMax) : []);
    const ratios: { portrait?: number; landscape?: number } = {};
    for (const orientation of ['portrait', 'landscape'] as const) {
      const value = await this.preferences.get<number>(KEY_RATIO[orientation]);
      if (typeof value === 'number' && Number.isFinite(value)) {
        ratios[orientation] = value;
      }
    }
    this.ratiosSignal.set(ratios);
  }

  private async write(list: readonly FileRef[], isInUse: (id: string) => boolean): Promise<void> {
    const kept = list.slice(0, TUNABLES.resources.recentFilesMax);
    for (const evicted of list.slice(TUNABLES.resources.recentFilesMax)) {
      if (!isInUse(evicted.id)) {
        await this.files.forget(evicted);
      }
    }
    this.recentSignal.set(kept);
    await this.preferences.set(KEY_RECENT, kept);
  }

  /** Changes run one after another so concurrent opens cannot lose entries. */
  private enqueue(change: () => Promise<void>): Promise<void> {
    this.pending = this.pending.then(change, change);
    return this.pending;
  }
}
