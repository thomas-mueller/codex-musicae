import { inject, Injectable, Injector } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { overwriteVerdict } from '../core';
import type { OverwriteAnswer, OverwriteVerdict } from '../core';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef } from '../ports/file-access';
import { PREFERENCES } from '../ports/preferences';

/** "Do not ask again": for every file, or for files of these names (D-1). */
interface StoredChoices {
  readonly all: boolean;
  readonly names: readonly string[];
}

const NONE: StoredChoices = { all: false, names: [] };

function parse(value: unknown): StoredChoices {
  const stored = value as Partial<StoredChoices> | null | undefined;
  return {
    all: stored?.all === true,
    names: Array.isArray(stored?.names) ? stored.names.filter((name): name is string => typeof name === 'string') : [],
  };
}

/**
 * What may be overwritten without asking. The stored choices persist where the build stores per-file choices; the answers of
 * this session and the files already warned about are remembered by file identity. FIL-033, FIL-038, FIL-039, FIL-041
 */
@Injectable({ providedIn: 'root' })
export class OverwriteChoices {
  private readonly preferences = inject(PREFERENCES);
  /** The file access is asked for when files are compared: "Reset all settings" needs none. */
  private readonly injector = inject(Injector);
  private stored: StoredChoices = NONE;
  private changed = false;
  private pending: Promise<void>;
  private readonly answers: { ref: FileRef; answer: OverwriteAnswer }[] = [];
  private readonly warned: FileRef[] = [];

  constructor() {
    this.pending = this.preferences.get<unknown>(TUNABLES.persistence.overwriteKey).then((value) => {
      // A choice made while the read was running wins.
      if (!this.changed) {
        this.stored = parse(value);
      }
    });
  }

  async verdict(ref: FileRef): Promise<OverwriteVerdict> {
    await this.pending;
    const found = await this.find(this.answers.map((entry) => entry.ref), ref);
    return overwriteVerdict({
      answer: this.answers.find((entry) => entry.ref === found)?.answer ?? 'none',
      silencedAll: this.stored.all,
      silencedName: this.stored.names.includes(ref.name),
    });
  }

  /** The answer for this session; the newest one counts. */
  answer(ref: FileRef, answer: Exclude<OverwriteAnswer, 'none'>): void {
    this.answers.unshift({ ref, answer });
  }

  /** "Do not ask again" for the files of this name, or for all files. */
  silence(scope: 'file' | 'all', name: string): Promise<void> {
    const next: StoredChoices =
      scope === 'all' ? { ...this.stored, all: true } : { ...this.stored, names: [...new Set([...this.stored.names, name])] };
    return this.store(next, () => this.preferences.set(TUNABLES.persistence.overwriteKey, next));
  }

  /** UIX-023: forgets the stored choices. The answers of this session are not settings and stay. */
  reset(): Promise<void> {
    return this.store(NONE, () => this.preferences.remove(TUNABLES.persistence.overwriteKey));
  }

  /** True the first time only for each file: the warning about a file that cannot be written appears once. */
  async firstWarning(ref: FileRef): Promise<boolean> {
    const before = [...this.warned];
    this.warned.push(ref); // at once, so that a second call running beside this one finds it
    return (await this.find(before, ref)) === undefined;
  }

  private store(next: StoredChoices, write: () => Promise<void>): Promise<void> {
    this.changed = true;
    this.stored = next;
    this.pending = this.pending.then(write, write);
    return this.pending;
  }

  private async find(refs: readonly FileRef[], ref: FileRef): Promise<FileRef | undefined> {
    for (const candidate of refs) {
      if (candidate.id === ref.id || (await this.injector.get(FILE_ACCESS).isSame(candidate, ref))) {
        return candidate;
      }
    }
    return undefined;
  }
}
