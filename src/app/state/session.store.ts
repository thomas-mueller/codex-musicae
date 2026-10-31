import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileAccessError, FileRef, OpenedFile } from '../ports/file-access';
import { PDF_RENDERER } from '../ports/pdf-renderer';
import type { Result } from '../ports/result';
import { BitmapCache } from './bitmap-cache';
import { DocumentStore } from './document.store';
import type { DocumentErrorCode, DocumentStatus } from './document.store';
import { PreferencesStore } from './preferences.store';
import { ResourceGovernor } from './resource-governor';

export interface Tab {
  readonly id: string;
  readonly ref: FileRef;
  readonly name: string;
  readonly status: DocumentStatus;
  readonly errorCode: DocumentErrorCode | null;
  readonly unsaved: boolean;
  readonly readOnly: boolean;
  readonly needsReopen: boolean;
}

export type OpenOutcome = 'opened' | 'cancelled' | 'failed' | 'repick';

interface TabEntry {
  readonly id: string;
  readonly ref: FileRef;
  readonly document: DocumentStore;
}

/** Open tabs and the active one. FIL-001, FIL-002, FIL-005, FIL-009, NFR-009, NFR-010 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly renderer = inject(PDF_RENDERER);
  private readonly files = inject(FILE_ACCESS);
  private readonly preferences = inject(PreferencesStore);
  private readonly bitmaps = inject(BitmapCache);
  private readonly governor = inject(ResourceGovernor);
  private readonly entries = signal<readonly TabEntry[]>([]);
  private readonly activeIdSignal = signal<string | null>(null);
  private readonly repickSignal = signal<ReadonlySet<string>>(new Set());
  private tabCounter = 0;
  private opening: Promise<void> = Promise.resolve();

  /** Status comes straight from each tab's DocumentStore, so nothing is synchronized by hand. */
  readonly tabs = computed<readonly Tab[]>(() =>
    this.entries().map((e) => ({
      id: e.id,
      ref: e.ref,
      name: e.ref.name,
      status: e.document.status(),
      errorCode: e.document.errorCode(),
      unsaved: e.document.unsaved(),
      readOnly: e.document.readOnly(),
      needsReopen: e.document.needsReopen(),
    })),
  );
  /** Recent entries whose access is lost: the next tap offers the picker (FIL-008). */
  readonly repickIds = this.repickSignal.asReadonly();
  readonly activeTabId = this.activeIdSignal.asReadonly();
  readonly activeTab = computed(() => this.tabs().find((t) => t.id === this.activeIdSignal()) ?? null);
  readonly activeDocument = computed(() => this.entries().find((e) => e.id === this.activeIdSignal())?.document ?? null);

  constructor() {
    // NFR-010, last step: under the heaviest memory pressure inactive tabs give up their bitmaps.
    effect(() => {
      if (this.governor.level() >= TUNABLES.resources.governorMaxLevel) {
        const active = this.activeIdSignal();
        for (const entry of this.entries()) {
          if (entry.id !== active) {
            this.bitmaps.releaseTab(entry.id);
          }
        }
      }
    });
  }

  /** FIL-002: a file that is already open only focuses its tab. Calls are processed in order. */
  openFiles(opened: readonly OpenedFile[]): Promise<void> {
    this.opening = this.opening.then(async () => {
      for (const file of opened) {
        await this.openOne(file);
      }
    });
    return this.opening;
  }

  /** FIL-001: the picker is called before any await so the browser still sees the user gesture. */
  pickAndOpen(): Promise<OpenOutcome> {
    return this.finishPick(this.files.pickPdfs());
  }

  /** FIL-008: reopen a recent file; lost access marks it, and the next tap offers the picker instead. */
  async reopenRecent(ref: FileRef): Promise<OpenOutcome> {
    if (this.repickSignal().has(ref.id)) {
      const outcome = await this.finishPick(this.files.pickPdfs(), ref);
      if (outcome === 'opened') {
        this.markRepick(ref.id, false);
      }
      return outcome;
    }
    const reopened = await this.files.reopen(ref);
    if (!reopened.ok) {
      this.markRepick(ref.id, true);
      return 'repick';
    }
    await this.openFiles([reopened.value]);
    return 'opened';
  }

  closeTab(id: string): void {
    const list = this.entries();
    const index = list.findIndex((e) => e.id === id);
    const entry = list[index];
    if (!entry) {
      return;
    }
    const remaining = list.filter((e) => e.id !== id);
    this.entries.set(remaining);
    if (this.activeIdSignal() === id) {
      this.activeIdSignal.set(remaining[index]?.id ?? remaining[index - 1]?.id ?? null);
    }
    this.bitmaps.releaseTab(id);
    void entry.document.dispose();
  }

  setActive(id: string): void {
    if (this.entries().some((e) => e.id === id)) {
      this.activeIdSignal.set(id);
    }
  }

  private async finishPick(
    picking: Promise<Result<readonly OpenedFile[], FileAccessError>>,
    replaced?: FileRef,
  ): Promise<OpenOutcome> {
    const picked = await picking;
    if (!picked.ok) {
      return picked.error === 'cancelled' ? 'cancelled' : 'failed';
    }
    if (replaced) {
      await this.preferences.removeRecent(replaced, (refId) => this.entries().some((e) => e.ref.id === refId));
    }
    await this.openFiles(picked.value);
    return 'opened';
  }

  private markRepick(id: string, on: boolean): void {
    this.repickSignal.update((ids) => {
      const next = new Set(ids);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private async openOne(file: OpenedFile): Promise<void> {
    for (const entry of this.entries()) {
      if (await this.files.isSame(entry.ref, file.ref)) {
        this.activeIdSignal.set(entry.id);
        if (entry.ref.id !== file.ref.id) {
          await this.files.forget(file.ref);
        }
        return;
      }
    }
    const id = `t${++this.tabCounter}`;
    const document = new DocumentStore(id, this.renderer);
    this.entries.update((list) => [...list, { id, ref: file.ref, document }]);
    this.activeIdSignal.set(id);
    void document.load(file.bytes);
    void this.preferences.addRecent(file.ref, (refId) => this.entries().some((e) => e.ref.id === refId));
  }
}
