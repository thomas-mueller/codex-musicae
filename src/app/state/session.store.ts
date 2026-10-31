import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef, OpenedFile } from '../ports/file-access';
import { PDF_RENDERER } from '../ports/pdf-renderer';
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
}

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
    })),
  );
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
