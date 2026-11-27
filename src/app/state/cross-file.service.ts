import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';

import { crossReferences, lookupFile, targetState } from '../core';
import type { FileRef as TargetRef, TargetState } from '../core';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef } from '../ports/file-access';
import { CrossFileChoices } from './cross-file-choices';
import { PreferencesStore } from './preferences.store';
import { SessionStore } from './session.store';
import type { ClosedFile, SessionEntry } from './session.store';
import { UiStore } from './ui.store';

/** 'no-access': the app knows the file but may not read it without the user. */
type ReferenceState = TargetState | 'no-access';
export type CrossFileReason = Exclude<ReferenceState, 'resolved' | 'pending'>;

export type CrossFileNotice =
  /** FIL-043, MRK-015: a referenced file or system that cannot be used. */
  | { readonly kind: 'unresolved'; readonly referrerId: string; readonly name: string; readonly reason: CrossFileReason }
  /** FIL-044: a file that open files refer to was closed. */
  | { readonly kind: 'closed'; readonly name: string; readonly referrers: readonly string[] };

interface Reference {
  readonly referrer: SessionEntry;
  readonly to: TargetRef;
}

/** Two names or ids as one key; the separator can be part of neither. */
const keyOf = (a: string, b: string): string => `${a}\u0000${b}`;
const isProblem = (state: ReferenceState): state is CrossFileReason => state !== 'resolved' && state !== 'pending';

/**
 * The files that open files refer to: opens them in the background where the app keeps access (FIL-042), says what state each
 * reference is in (MRK-016) and queues the warnings (FIL-043, FIL-044, MRK-015). Nothing here writes into a file, and every
 * state is derived from the open files. No feature switch: it works the same in every edition (MRK-017, EDN-017).
 */
@Injectable({ providedIn: 'root' })
export class CrossFileService {
  private readonly session = inject(SessionStore);
  private readonly preferences = inject(PreferencesStore);
  private readonly files = inject(FILE_ACCESS);
  private readonly ui = inject(UiStore);
  private readonly choices = inject(CrossFileChoices);

  /** Why a name that no open file has could not be opened from the recent list. */
  private readonly stored = signal<ReadonlyMap<string, 'ambiguous' | 'no-access'>>(new Map());
  /** (referring entry, name) pairs looked at; a file is opened automatically once for each. */
  private readonly seen = new Set<string>();
  /** The pairs whose look-up has ended: only then is a missing file worth a warning. */
  private readonly looked = signal<ReadonlySet<string>>(new Set());
  /** FIL-043: (referring file, target file) names already warned about in this session. */
  private readonly warned = new Set<string>();
  private readonly queue = signal<readonly CrossFileNotice[]>([]);
  private work: Promise<void> = Promise.resolve();

  /** Every reference of every open file into another file. */
  private readonly references = computed<readonly Reference[]>(() =>
    this.session
      .sessionEntries()
      .flatMap((referrer) => crossReferences(referrer.document.systemMarks()).map((to) => ({ referrer, to }))),
  );

  /** The notice to show; none in presentation mode or while a stroke is drawn (they wait). */
  readonly notice = computed<CrossFileNotice | null>(() => {
    if (this.ui.mode() === 'presentation' || this.ui.strokeInProgress()) {
      return null;
    }
    return this.queue().find((notice) => notice.kind !== 'closed' || !this.choices.closeSilenced()) ?? null;
  });

  constructor() {
    this.session.onClosed((closed) => this.fileClosed(closed));
    effect(() => {
      if (!this.session.restored()) {
        return; // FIL-011: the files of the last session come first
      }
      const references = this.references();
      untracked(() => references.forEach((reference) => this.look(reference)));
    });
    effect(() => this.updateNotices());
  }

  /** The state of one reference of the file `referrerId`, and the open file it leads to. */
  stateOf(referrerId: string, to: TargetRef): { readonly state: ReferenceState; readonly target: SessionEntry | null } {
    const matches = this.openFiles(referrerId, to.file);
    const target = matches.length === 1 ? matches[0]! : null;
    if (target?.document.needsReopen()) {
      return { state: 'no-access', target };
    }
    const state = targetState(
      to,
      matches.map(({ document }) => ({
        pageCount: document.pageInfos().length,
        pageSystemCounts: document.knownSystemCounts(),
        failed: document.status() === 'error',
      })),
    );
    return { state: state === 'missing-file' && !target ? (this.stored().get(to.file) ?? state) : state, target };
  }

  dismiss(notice: CrossFileNotice): void {
    this.queue.update((list) => list.filter((other) => !this.sameNotice(other, notice)));
  }

  /** FIL-044 */
  silenceCloseWarning(): Promise<void> {
    this.queue.update((list) => list.filter((notice) => notice.kind !== 'closed'));
    return this.choices.silenceClose();
  }

  /**
   * FIL-043: "Open file" of a warning. Must be called inside the tap: the browser's permission question, or else the picker,
   * comes before anything that waits. The current file stays current.
   */
  async openMissing(notice: CrossFileNotice & { kind: 'unresolved' }): Promise<void> {
    if (notice.reason === 'no-access') {
      const placeholder = this.openFiles(notice.referrerId, notice.name)[0];
      if (placeholder) {
        await this.session.reopenInBackground(placeholder.id);
        return;
      }
      const ref = this.preferences.recentFiles().find((recent) => recent.name === notice.name);
      if (ref) {
        const reopened = await this.files.reopen(ref);
        if (reopened.ok) {
          await this.session.openFiles([reopened.value], { background: true });
          return;
        }
        if (reopened.error !== 'not-found' && reopened.error !== 'denied') {
          return;
        }
      }
    }
    const picked = await this.files.pickPdfs();
    if (picked.ok) {
      await this.session.openFiles(picked.value, { background: true });
    }
  }

  private openFiles(referrerId: string, name: string): readonly SessionEntry[] {
    return this.session.sessionEntries().filter((entry) => entry.id !== referrerId && entry.ref.name === name);
  }

  /** Once per referring entry and name, so a file the user closes is not opened again behind their back. */
  private look({ referrer, to }: Reference): void {
    const key = keyOf(referrer.id, to.file);
    if (this.seen.has(key)) {
      return;
    }
    this.seen.add(key);
    const done = (): void => this.looked.update((keys) => new Set(keys).add(key));
    // one after the other: a file two references need is opened once
    this.work = this.work.then(() => this.openReferenced(referrer.id, to.file)).then(done, done);
  }

  /** FIL-042, FIL-045: its own references follow through the same effect; a file already open ends the chain, so loops do. */
  private async openReferenced(referrerId: string, name: string): Promise<void> {
    await this.preferences.ready;
    const referrer = this.entry(referrerId);
    if (!referrer || this.openFiles(referrerId, name).length > 0) {
      return;
    }
    const accessible: FileRef[] = this.preferences.recentFiles().filter((ref) => ref.id !== referrer.ref.id);
    const found = lookupFile(name, [], accessible);
    if (found.kind === 'several') {
      this.remember(name, 'ambiguous');
    }
    if (found.kind !== 'reopen') {
      return;
    }
    const reopened = await this.files.reopen(accessible.find((ref) => ref.id === found.id)!);
    if (!reopened.ok) {
      if (reopened.error === 'needs-user-gesture' || reopened.error === 'denied') {
        this.remember(name, 'no-access');
      }
    } else if (this.entry(referrerId) && this.openFiles(referrerId, name).length === 0) {
      await this.session.openFiles([reopened.value], { background: true, remember: false });
    }
  }

  private remember(name: string, reason: 'ambiguous' | 'no-access'): void {
    this.stored.update((map) => new Map(map).set(name, reason));
  }

  private entry(id: string): SessionEntry | undefined {
    return this.session.sessionEntries().find((entry) => entry.id === id);
  }

  /** Queues the warnings not given yet and drops those whose problem is gone. */
  private updateNotices(): void {
    const looked = this.looked();
    const problems = this.references().flatMap(({ referrer, to }) => {
      const { state } = this.stateOf(referrer.id, to);
      const settled = state !== 'missing-file' || looked.has(keyOf(referrer.id, to.file));
      return isProblem(state) && settled ? [{ referrer, name: to.file, reason: state }] : [];
    });
    const open = new Set(this.session.sessionEntries().map((entry) => entry.ref.name));
    untracked(() => {
      const kept = this.queue().flatMap((notice): CrossFileNotice[] => {
        if (notice.kind === 'closed') {
          return open.has(notice.name) ? [] : [notice];
        }
        const now = problems.find((p) => p.referrer.id === notice.referrerId && p.name === notice.name);
        return now ? [{ ...notice, reason: now.reason }] : [];
      });
      for (const { referrer, name, reason } of problems) {
        const pair = keyOf(referrer.ref.name, name);
        if (!this.warned.has(pair)) {
          this.warned.add(pair);
          kept.push({ kind: 'unresolved', referrerId: referrer.id, name, reason });
        }
      }
      this.queue.set(kept);
    });
  }

  /** FIL-044: runs at once, before the effects see the shorter list, so that no "not found" warning follows. */
  private fileClosed(closed: ClosedFile): void {
    const entries = this.session.sessionEntries();
    if (entries.some((entry) => entry.ref.name === closed.name)) {
      return;
    }
    const referrers = entries.filter((entry) =>
      crossReferences(entry.document.systemMarks()).some((to) => to.file === closed.name),
    );
    if (referrers.length === 0) {
      return;
    }
    for (const referrer of referrers) {
      this.warned.add(keyOf(referrer.ref.name, closed.name));
    }
    if (!this.choices.closeSilenced()) {
      this.queue.update((list) => [
        ...list,
        { kind: 'closed', name: closed.name, referrers: referrers.map((entry) => entry.ref.name) },
      ]);
    }
  }

  private sameNotice(a: CrossFileNotice, b: CrossFileNotice): boolean {
    return a.kind === 'unresolved'
      ? b.kind === 'unresolved' && a.referrerId === b.referrerId && a.name === b.name
      : b.kind === 'closed' && a.name === b.name;
  }
}
