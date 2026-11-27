import { computed, effect, inject, Injectable, Injector, signal, untracked } from '@angular/core';
import type { WritableSignal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { closeStep, parseMetadata, parseSession, reconcileMetadata } from '../core';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { APP_VERSION_FULL } from '../ports/app-version';
import { FEATURE_FLAGS } from '../ports/feature-flags';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileAccessError, FileRef, OpenedFile } from '../ports/file-access';
import { PDF_RENDERER } from '../ports/pdf-renderer';
import { PDF_WRITER } from '../ports/pdf-writer';
import { PREFERENCES } from '../ports/preferences';
import type { Result } from '../ports/result';
import { BitmapCache } from './bitmap-cache';
import { CLOCK } from './clock';
import { DetectionService } from './detection.service';
import { DocumentStore } from './document.store';
import { FilePrompts } from './file-prompts';
import type { FilePrompt } from './file-prompts';
import { OverwriteChoices } from './overwrite-choices';
import type { DocumentErrorCode, DocumentStatus } from './document.store';
import { PreferencesStore } from './preferences.store';
import { RatioDefaultsProvider } from './ratio-defaults';
import { loadInk } from './loaded-ink';
import { SavePipeline } from './save-pipeline';
import { SaveService } from './save.service';
import { Scheduler } from './scheduler';

export interface Tab {
  readonly id: string;
  readonly ref: FileRef;
  readonly name: string;
  readonly status: DocumentStatus;
  readonly errorCode: DocumentErrorCode | null;
  readonly unsaved: boolean;
  readonly saveFailed: boolean;
  readonly needsWriteAccess: boolean;
  readonly readOnly: boolean;
  readonly needsReopen: boolean;
}

/** The answers of the two save questions. */
export type OverwriteReply = 'overwrite' | 'saveAs' | 'cancel';
export type CloseReply = 'saveAs' | 'discard' | 'cancel';
/** 'copied': there is no way to choose a file to continue in, so a copy was downloaded and the entry stays as it was. */
type SaveAsOutcome = 'saved' | 'copied' | 'cancelled' | 'failed';

type OpenOutcome = 'opened' | 'cancelled' | 'failed' | 'repick';

/**
 * A tab restored from the previous session has no file until `attachFile` runs (FIL-011, FIL-013): `saver` and `pipeline`
 * are null and its document is in status `restoring`.
 */
interface TabEntry {
  readonly id: string;
  readonly ref: WritableSignal<FileRef>;
  readonly document: DocumentStore;
  saver: SaveService | null;
  pipeline: SavePipeline | null;
  /** FIL-014: the stored system, applied once the document and its detection are ready. */
  readonly pendingSystem: WritableSignal<number | null>;
  /** True while a (re)open of this restored tab is running. */
  reopening: boolean;
}

/** What `SessionPersistence` needs of a tab. */
interface SessionEntry {
  readonly ref: FileRef;
  readonly document: DocumentStore;
  readonly pendingSystem: number | null;
}

/** Open tabs and the active one. FIL-001, FIL-002, FIL-005, FIL-009, FIL-031, NFR-020 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly renderer = inject(PDF_RENDERER);
  private readonly files = inject(FILE_ACCESS);
  private readonly preferences = inject(PreferencesStore);
  private readonly bitmaps = inject(BitmapCache);
  private readonly detection = inject(DetectionService);
  private readonly ratioDefaults = inject(RatioDefaultsProvider);
  private readonly clock = inject(CLOCK);
  private readonly lifecycle = inject(APP_LIFECYCLE);
  private readonly injector = inject(Injector);
  private readonly writer = inject(PDF_WRITER);
  private readonly scheduler = inject(Scheduler);
  private readonly appVersion = inject(APP_VERSION_FULL);
  private readonly prefs = inject(PREFERENCES);
  private readonly flags = inject(FEATURE_FLAGS);
  private readonly choices = inject(OverwriteChoices);
  private readonly prompts = inject(FilePrompts);
  private readonly entries = signal<readonly TabEntry[]>([]);
  private readonly activeIdSignal = signal<string | null>(null);
  private readonly repickSignal = signal<ReadonlySet<string>>(new Set());
  private readonly restoredSignal = signal(false);
  private tabCounter = 0;
  private opening: Promise<void> = Promise.resolve();

  /** Status comes straight from each tab's DocumentStore, so nothing is synchronized by hand. */
  readonly tabs = computed<readonly Tab[]>(() =>
    this.entries().map((e) => ({
      id: e.id,
      ref: e.ref(),
      name: e.ref().name,
      status: e.document.status(),
      errorCode: e.document.errorCode(),
      unsaved: e.document.unsaved(),
      saveFailed: e.document.saveFailed(),
      needsWriteAccess: e.document.needsWriteAccess(),
      readOnly: e.document.readOnly(),
      needsReopen: e.document.needsReopen(),
    })),
  );
  /** Recent entries whose access is lost: the next tap offers the picker (FIL-008). */
  readonly repickIds = this.repickSignal.asReadonly();
  /** True once `restore()` has finished; the session snapshot is not written before (FIL-011). */
  readonly restored = this.restoredSignal.asReadonly();
  /** For `SessionPersistence`: every tab with its document, in tab order. */
  readonly sessionEntries = computed<readonly SessionEntry[]>(() =>
    this.entries().map((e) => ({ ref: e.ref(), document: e.document, pendingSystem: e.pendingSystem() })),
  );
  readonly activeTabId = this.activeIdSignal.asReadonly();
  readonly activeTab = computed(() => this.tabs().find((t) => t.id === this.activeIdSignal()) ?? null);
  readonly activeDocument = computed(() => this.entries().find((e) => e.id === this.activeIdSignal())?.document ?? null);

  constructor() {
    // SAV-009: when the app is paused or hidden every dirty tab saves; nothing waits for it.
    this.lifecycle.onPause(() => {
      for (const entry of this.entries()) {
        if (entry.saver?.dirty()) {
          void entry.saver.force();
        }
      }
    });
    // NFR-020: a file that stops being the current one gives up everything rendered of it, whatever made it so.
    effect(() => {
      const active = this.activeIdSignal();
      const entries = this.entries();
      untracked(() => {
        for (const entry of entries) {
          const shown = entry.id === active;
          if (!shown && entry.document.shown) {
            this.bitmaps.releaseTab(entry.id);
            entry.document.releaseRendered();
          }
          entry.document.shown = shown;
        }
      });
    });
  }

  /** What is kept rendered of every open file (development debug hook, NFR-020 E2E). */
  renderedBytes(): readonly { readonly name: string; readonly active: boolean; readonly cacheBytes: number; readonly rasterBytes: number }[] {
    return this.entries().map((entry) => ({
      name: entry.ref().name,
      active: entry.id === this.activeIdSignal(),
      cacheBytes: this.bitmaps.bytesOf(entry.id),
      rasterBytes: entry.document.handle()?.renderedBytes?.() ?? 0,
    }));
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

  /**
   * FIL-006, FIL-046, FIL-047, FIL-049: closes a file without unsaved changes at once. Otherwise it saves first where it
   * may; where it may not, or the overwrite question is open, the file stays and the user is asked. A failed save keeps it
   * open (error icon). Resolves to true when the file is closed.
   */
  closeTab(id: string): Promise<boolean> {
    const entry = this.entries().find((e) => e.id === id);
    if (!entry) {
      return Promise.resolve(true);
    }
    if (entry.document.needsWriteAccess()) {
      // the click on the close icon is the gesture the browser needs for its permission prompt
      return this.grantWriteAccess(id).then((saved) => {
        if (saved) {
          this.remove(entry);
        }
        return saved;
      });
    }
    if (!this.modified(entry)) {
      this.remove(entry);
      return Promise.resolve(true);
    }
    return this.closeModified(entry);
  }

  /** The answer to the overwrite question. Must be called inside the tap: saving may need a browser permission or picker. */
  async answerOverwrite(prompt: FilePrompt & { kind: 'overwrite' }, reply: OverwriteReply, silence: 'file' | 'all' | null = null): Promise<void> {
    const entry = this.entries().find((e) => e.id === prompt.tabId);
    if (!entry) {
      this.prompts.drop(prompt.tabId);
      return;
    }
    if (reply === 'saveAs') {
      await this.saveAsAndClose(entry, prompt.closing);
      return;
    }
    this.prompts.dismiss(entry.id);
    if (reply === 'cancel') {
      this.choices.answer(entry.ref(), 'declined');
      entry.document.saveHeld.set(true);
      return;
    }
    this.choices.answer(entry.ref(), 'allowed');
    // "Do not ask again" belongs to Overwrite only (DEC-166)
    const stored = silence === null ? Promise.resolve() : this.choices.silence(silence, entry.ref().name);
    this.proceed(entry, prompt.closing);
    await stored;
    await this.answerSilenced();
  }

  /** The answer to the question of a close that would lose changes. FIL-046, FIL-049 */
  async answerClose(prompt: FilePrompt & { kind: 'close' }, reply: CloseReply): Promise<void> {
    const entry = this.entries().find((e) => e.id === prompt.tabId);
    if (!entry || reply === 'cancel') {
      this.prompts.dismiss(prompt.tabId);
    } else if (reply === 'discard') {
      this.remove(entry);
    } else {
      await this.saveAsAndClose(entry, true);
    }
  }

  /**
   * FIL-037: the user chooses a new file, which then is the file of this entry. Must be called inside the tap: the picker is
   * the first thing that happens.
   */
  async saveAsNewFile(id: string | null = this.activeIdSignal()): Promise<SaveAsOutcome> {
    const entry = this.entries().find((e) => e.id === id);
    const pipeline = entry?.pipeline;
    const saver = entry?.saver;
    if (!this.flags.saveCopy || !entry || !pipeline || !saver) {
      return 'failed'; // EDN-001
    }
    const created = await this.files.createFile(pipeline.suggestedName());
    if (!created.ok) {
      if (created.error === 'unsupported') {
        return (await pipeline.saveCopy(new AbortController().signal)).ok ? 'copied' : 'failed';
      }
      return created.error === 'cancelled' ? 'cancelled' : this.saveAsFailed(entry);
    }
    const target = created.value;
    for (const other of this.entries()) {
      if (other !== entry && (await this.files.isSame(other.ref(), target))) {
        return this.saveAsFailed(entry); // two entries would write into one file
      }
    }
    this.choices.answer(target, 'allowed'); // the user has just chosen this file: no overwrite question for it
    const saved = await saver.saveNow(async (signal) => {
      const written = await pipeline.writeTo(target, signal);
      if (written) {
        entry.ref.set(target);
        entry.document.readOnly.set(false);
        entry.document.needsWriteAccess.set(false);
        entry.document.saveHeld.set(false);
      }
      return written;
    });
    if (!saved) {
      await this.files.forget(target);
      return 'failed';
    }
    this.prompts.drop(entry.id);
    void this.preferences.addRecent(target, (refId) => this.entries().some((e) => e.ref().id === refId));
    return 'saved';
  }

  private modified(entry: TabEntry): boolean {
    return entry.saver !== null && (entry.saver.dirty() || entry.saver.saving());
  }

  private async closeModified(entry: TabEntry): Promise<boolean> {
    const canWrite = this.flags.autosave && !entry.document.readOnly();
    const verdict = canWrite ? await this.choices.verdict(entry.ref()) : 'hold';
    if (!this.entries().includes(entry)) {
      return true;
    }
    const step = closeStep({ modified: this.modified(entry), canWrite, verdict });
    if (step === 'askOverwrite') {
      this.prompts.ask({ kind: 'overwrite', tabId: entry.id, closing: true });
      return false;
    }
    if (step === 'askDiscard') {
      this.prompts.ask({ kind: 'close', tabId: entry.id });
      return false;
    }
    if (step === 'save') {
      entry.document.saveHeld.set(false);
      if (!(await entry.saver!.force()) || entry.document.needsWriteAccess()) {
        return false;
      }
      if (this.modified(entry)) {
        // the file turned out not to be writable while saving
        if (entry.document.readOnly()) {
          this.prompts.ask({ kind: 'close', tabId: entry.id });
        }
        return false;
      }
    }
    this.remove(entry);
    return true;
  }

  private async saveAsAndClose(entry: TabEntry, closing: boolean): Promise<void> {
    const outcome = await this.saveAsNewFile(entry.id);
    if (outcome === 'saved' && closing) {
      await this.closeTab(entry.id);
    }
    // a cancelled picker, a failure or a downloaded copy leaves the question open: the entry's file is still unsaved
  }

  private proceed(entry: TabEntry, closing: boolean): void {
    if (closing) {
      void this.closeTab(entry.id);
    } else {
      entry.saver?.resume();
    }
  }

  /** After "do not ask again", waiting questions that need no answer any more are answered with Overwrite. */
  private async answerSilenced(): Promise<void> {
    for (const prompt of this.prompts.waiting()) {
      const entry = this.entries().find((e) => e.id === prompt.tabId);
      if (prompt.kind === 'overwrite' && entry && (await this.choices.verdict(entry.ref())) === 'write') {
        this.prompts.dismiss(entry.id);
        this.proceed(entry, prompt.closing);
      }
    }
  }

  private saveAsFailed(entry: TabEntry): 'failed' {
    entry.document.saveFailed.set(true);
    return 'failed';
  }

  /** FIL-034: before an autosave writes. Asks when the answer is not known yet. */
  private async permit(entry: TabEntry): Promise<boolean> {
    const verdict = await this.choices.verdict(entry.ref());
    if (verdict === 'ask' && this.entries().includes(entry)) {
      this.prompts.ask({ kind: 'overwrite', tabId: entry.id, closing: false });
    }
    return verdict === 'write';
  }

  /** FIL-039: once per file and session. */
  private async warnUnwritable(entry: TabEntry): Promise<void> {
    if ((await this.choices.firstWarning(entry.ref())) && this.entries().includes(entry)) {
      this.prompts.showNotice(entry.id);
    }
  }

  /**
   * FIL-016: asks the user for the write permission an autosave could not ask for, then saves. Must be called inside a user
   * gesture (the click on the tab, its marker or its close icon). A refusal makes the tab read-only.
   */
  grantWriteAccess(id: string): Promise<boolean> {
    const entry = this.entries().find((e) => e.id === id);
    if (!entry) {
      return Promise.resolve(false);
    }
    if (!entry.saver) {
      return Promise.resolve(false);
    }
    if (!this.flags.autosave) {
      return Promise.resolve(false); // EDN-001: nothing is written, so there is no access to ask for
    }
    const saver = entry.saver;
    return this.files.requestWriteAccess(entry.ref()).then((result) => {
      if (result.ok) {
        entry.document.needsWriteAccess.set(false);
        return saver.force();
      }
      if (result.error === 'denied' || result.error === 'unsupported') {
        entry.document.needsWriteAccess.set(false);
        entry.document.readOnly.set(true);
      }
      return false;
    });
  }

  private remove(entry: TabEntry): void {
    const list = this.entries();
    const index = list.indexOf(entry);
    if (index < 0) {
      return;
    }
    const remaining = list.filter((e) => e !== entry);
    this.entries.set(remaining);
    if (this.activeIdSignal() === entry.id) {
      this.activeIdSignal.set(remaining[index]?.id ?? remaining[index - 1]?.id ?? null);
    }
    this.prompts.drop(entry.id);
    entry.saver?.dispose();
    this.bitmaps.releaseTab(entry.id);
    this.detection.stop(entry.document);
    void entry.document.dispose();
  }

  setActive(id: string): void {
    const entry = this.entries().find((e) => e.id === id);
    if (entry) {
      if (entry.document.needsReopen()) {
        void this.reopenTab(entry); // the click that selects the tab is the user gesture the reopen may need (FIL-013)
      }
      if (entry.document.needsWriteAccess()) {
        void this.grantWriteAccess(id); // the click that selects the tab is a user gesture
      }
      this.forceSave(this.activeIdSignal(), id);
      this.activeIdSignal.set(id);
    }
  }

  /** SAV-009: the tab being left saves at once (not awaited). */
  private forceSave(leftId: string | null, enteredId: string): void {
    if (leftId !== null && leftId !== enteredId) {
      const left = this.entries().find((e) => e.id === leftId);
      if (left?.saver?.dirty()) {
        void left.saver.force();
      }
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
      await this.preferences.removeRecent(replaced, (refId) => this.entries().some((e) => e.ref().id === refId));
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

  /**
   * SAV-005, SAV-006, SAV-012, DET-023: reads what an earlier session (or another app) left in the file. Data that cannot be
   * used (none, invalid, other page count, read error) is ignored and detection runs as for any new file; data from a newer
   * version is never overwritten. Detection starts only when it was not restored.
   */
  private async restoreFromFile(entry: TabEntry, bytes: Uint8Array): Promise<void> {
    const { document, pipeline, saver } = entry;
    if (!pipeline || !saver) {
      return;
    }
    let detectionRestored = false;
    try {
      const [json, ink] = await Promise.all([this.writer.readEmbeddedJson(bytes), this.writer.listInk(bytes)]);
      if (!this.entries().includes(entry)) {
        return;
      }
      if (json.ok && json.value !== null) {
        const parsed = parseMetadata(json.value, TUNABLES.playingOrder.maxLength);
        if (parsed.kind === 'newer') {
          pipeline.metadataNewer = true;
        } else if (parsed.kind === 'ok') {
          const meta = reconcileMetadata(parsed.value, document.pageInfos().length);
          detectionRestored = meta !== null && document.hydrateFromMetadata(meta, parsed.pendingV1Marks);
        }
      }
      if (ink.ok) {
        const loaded = loadInk(ink.value, document.pageInfos().length);
        document.loadSavedStrokes(loaded.strokes);
        pipeline.registerSavedInk(loaded.saved);
      }
      saver.rebaseline();
    } catch {
      // unreadable data counts as no data
    }
    if (!detectionRestored && this.entries().includes(entry)) {
      this.detection.start(document);
    }
  }

  private async openOne(file: OpenedFile): Promise<void> {
    for (const entry of this.entries()) {
      if (await this.files.isSame(entry.ref(), file.ref)) {
        this.activeIdSignal.set(entry.id);
        if (entry.ref().id !== file.ref.id) {
          await this.files.forget(file.ref);
        }
        return;
      }
    }
    const entry = this.addEntry(file.ref);
    this.forceSave(this.activeIdSignal(), entry.id);
    this.activeIdSignal.set(entry.id);
    this.attachFile(entry, file);
  }

  private addEntry(ref: FileRef): TabEntry {
    const id = `t${++this.tabCounter}`;
    const document = new DocumentStore(id, this.renderer, this.ratioDefaults, () => this.clock.now());
    const entry: TabEntry = { id, ref: signal(ref), document, saver: null, pipeline: null, pendingSystem: signal(null), reopening: false };
    this.entries.update((list) => [...list, entry]);
    return entry;
  }

  /** Gives a tab its file: save pipeline, autosave, load, and what the file itself remembers (SAV-005, DET-023). */
  private attachFile(entry: TabEntry, file: OpenedFile): void {
    const { document } = entry;
    document.readOnly.set(!file.writable);
    entry.pipeline = new SavePipeline(document, file.ref, file.bytes, this.files, this.writer, this.scheduler, this.appVersion);
    entry.saver = new SaveService(document, this.clock, entry.pipeline.run, TUNABLES.saving.autosaveIdleMs, this.injector, this.flags.autosave, {
      permit: () => this.permit(entry),
      onUnwritable: () => void this.warnUnwritable(entry),
    });
    this.applyPendingPosition(entry);
    void document.load(file.bytes).then(() => {
      if (document.status() === 'ready') {
        void this.restoreFromFile(entry, file.bytes);
      }
    });
    void this.preferences.addRecent(file.ref, (refId) => this.entries().some((e) => e.ref().id === refId));
  }

  /**
   * FIL-011, FIL-013, NFR-015: reopens the tabs of the previous session. A tab whose file cannot be reopened without the user
   * (no handle, permission to ask for, access lost) stays a placeholder marked `needsReopen`. Always ends in annotation mode:
   * nothing here touches the UI mode (FIL-012).
   */
  async restore(): Promise<void> {
    try {
      if (!this.flags.sessionRestore) {
        return; // EDN-005: nothing is read, the app starts empty
      }
      const snapshot = parseSession(await this.prefs.get(TUNABLES.persistence.sessionKey));
      if (!snapshot || snapshot.tabs.length === 0) {
        return;
      }
      const restoring = snapshot.tabs.map((tab) => {
        const entry = this.addEntry(tab.ref);
        entry.document.markRestoring();
        entry.pendingSystem.set(tab.system);
        entry.document.orgRestore.set({ page: tab.orgPage, offset: tab.orgOffset });
        return entry;
      });
      this.activeIdSignal.set(restoring[snapshot.activeIndex]?.id ?? restoring[0]?.id ?? null);
      for (const entry of restoring) {
        if (!this.entries().includes(entry)) {
          continue;
        }
        entry.reopening = true;
        const reopened = await this.files.reopen(entry.ref());
        entry.reopening = false;
        if (!this.entries().includes(entry)) {
          continue;
        }
        if (reopened.ok) {
          this.attachFile(entry, reopened.value);
        } else {
          entry.document.needsReopen.set(true);
        }
      }
    } catch {
      // an unreadable stored session counts as none
    } finally {
      this.restoredSignal.set(true);
    }
  }

  /**
   * FIL-013: one tap on a tab that needs re-opening. Runs inside the click, so the first call happens before any await.
   * When the file is gone for good (`not-found`, or access lost) the same tap opens the picker and the picked file replaces
   * the tab's file; the stored position is kept.
   */
  private async reopenTab(entry: TabEntry): Promise<void> {
    if (entry.reopening) {
      return;
    }
    entry.reopening = true;
    try {
      const reopened = await this.files.reopen(entry.ref());
      if (reopened.ok) {
        entry.document.needsReopen.set(false);
        this.attachFile(entry, reopened.value);
        return;
      }
      if (reopened.error !== 'not-found' && reopened.error !== 'denied') {
        return;
      }
      const picked = await this.files.pickPdfs();
      const first = picked.ok ? picked.value[0] : undefined;
      if (!picked.ok || !first || !this.entries().includes(entry)) {
        return;
      }
      const old = entry.ref();
      entry.ref.set(first.ref);
      entry.document.needsReopen.set(false);
      await this.files.forget(old);
      this.attachFile(entry, first);
      if (picked.value.length > 1) {
        await this.openFiles(picked.value.slice(1));
      }
    } finally {
      entry.reopening = false;
    }
  }

  /** FIL-014: once the document and its detection are final the stored system becomes the current slide. */
  private applyPendingPosition(entry: TabEntry): void {
    if (entry.pendingSystem() === null) {
      return;
    }
    const watcher = effect(
      () => {
        const document = entry.document;
        if (document.status() === 'error') {
          entry.pendingSystem.set(null);
          watcher.destroy();
        } else if (document.status() === 'ready' && document.detectionFinished()) {
          untracked(() => {
            const system = entry.pendingSystem();
            if (system !== null) {
              document.restorePosition(system);
              entry.pendingSystem.set(null);
            }
          });
          watcher.destroy();
        }
      },
      { injector: this.injector },
    );
  }
}
