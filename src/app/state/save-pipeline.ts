import { TUNABLES } from '../../config/tunables';
import { serializeMetadata } from '../core';
import type { FileAccess, FileAccessError, FileRef } from '../ports/file-access';
import type { InkToAdd, PdfEdits, PdfWriter } from '../ports/pdf-writer';
import { err, ok } from '../ports/result';
import type { Result } from '../ports/result';
import type { DocumentStore } from './document.store';
import type { Scheduler } from './scheduler';

/** A stroke that exists in the file as of the pipeline's current bytes. */
export interface SavedInk {
  readonly pageIndex: number;
  readonly annotationRef: string;
}

/** What one save (or copy) sends to the writer; the same snapshot is committed after the write succeeded. */
interface Snapshot {
  readonly edits: PdfEdits;
  readonly added: readonly InkToAdd[];
  readonly removed: readonly string[];
}

const PDF_EXTENSION = new RegExp(`${TUNABLES.files.pdfExtension.replace('.', '\\.')}$`, 'i');

/**
 * SAV-009, SAV-010, SAV-011, FIL-016: one per tab. Owns the bytes of the file as last read or written and knows which
 * strokes they contain, so a save sends only the difference. State changes only after `FileAccess.write` succeeded.
 */
export class SavePipeline {
  /** Set when the file's embedded data is from a newer version: never overwritten, ink is still saved (SAV-003). */
  metadataNewer = false;
  private bytes: Uint8Array;
  private readonly savedInk = new Map<string, SavedInk>();

  constructor(
    private readonly doc: DocumentStore,
    private readonly ref: FileRef,
    bytes: Uint8Array,
    private readonly files: FileAccess,
    private readonly writer: PdfWriter,
    private readonly scheduler: Scheduler,
    private readonly appVersion: string,
  ) {
    this.bytes = bytes;
  }

  get currentBytes(): Uint8Array {
    return this.bytes;
  }

  /** Strokes read from the file (SAV-006, ANN-005): they are in the model and in the file, so nothing is added for them. */
  registerSavedInk(entries: ReadonlyArray<SavedInk & { readonly strokeId: string }>): void {
    for (const { strokeId, pageIndex, annotationRef } of entries) {
      this.savedInk.set(strokeId, { pageIndex, annotationRef });
    }
  }

  /** The save runner of the tab's `SaveService`. */
  readonly run = async (signal: AbortSignal): Promise<boolean | 'readOnly'> => {
    const snapshot = this.snapshot();
    const applied = await this.apply(snapshot.edits, signal);
    if (!applied.ok) {
      return false;
    }
    const written = await this.files.write(this.ref, applied.value);
    if (!written.ok) {
      if (written.error === 'denied' || written.error === 'unsupported') {
        this.doc.readOnly.set(true);
        return 'readOnly';
      }
      return false;
    }
    this.bytes = applied.value;
    this.commit(snapshot);
    return true;
  };

  /** SAV-011: the file as it would be saved now; nothing is marked saved. */
  async buildCopy(signal: AbortSignal): Promise<Result<Uint8Array, 'failed'>> {
    const applied = await this.apply(this.snapshot().edits, signal);
    return applied.ok ? ok(applied.value) : err('failed');
  }

  /** SAV-011, PLT-010: "<name> (annotated).pdf" through the platform's save-as. */
  async saveCopy(signal: AbortSignal): Promise<Result<void, FileAccessError | 'failed'>> {
    const built = await this.buildCopy(signal);
    if (!built.ok) {
      return built;
    }
    const base = this.ref.name.replace(PDF_EXTENSION, '');
    return this.files.saveCopy(`${base}${TUNABLES.files.copySuffix}${TUNABLES.files.pdfExtension}`, built.value);
  }

  private snapshot(): Snapshot {
    const strokes = this.doc.strokes();
    const present = new Set(strokes.map((s) => s.id));
    const added: InkToAdd[] = strokes
      .filter((s) => !this.savedInk.has(s.id))
      .map((s) => ({
        pageIndex: s.pageIndex,
        strokeId: s.id,
        points: s.points,
        color: s.color,
        widthPt: s.widthPt,
        opacity: s.opacity,
        multiply: s.multiply,
      }));
    const gone = [...this.savedInk].filter(([id]) => !present.has(id));
    return {
      added,
      removed: gone.map(([id]) => id),
      edits: {
        addInk: added,
        removeInk: gone.map(([, saved]) => ({ pageIndex: saved.pageIndex, annotationRef: saved.annotationRef })),
        embeddedJson: this.metadataNewer ? null : serializeMetadata(this.doc.buildMetadata(this.appVersion)),
      },
    };
  }

  private commit(snapshot: Snapshot): void {
    for (const id of snapshot.removed) {
      this.savedInk.delete(id);
    }
    for (const ink of snapshot.added) {
      this.savedInk.set(ink.strokeId, { pageIndex: ink.pageIndex, annotationRef: `nm:${ink.strokeId}` });
    }
  }

  /** The writer runs in a worker as a `save` task: it never starts while a stroke is in progress. */
  private async apply(edits: PdfEdits, signal: AbortSignal): Promise<Result<Uint8Array, 'failed'>> {
    const bytes = this.bytes;
    const task = await this.scheduler.submit('save', (taskSignal) =>
      this.writer.apply(bytes, edits, AbortSignal.any([signal, taskSignal])),
    );
    return task.ok && task.value.ok ? ok(task.value.value) : err('failed');
  }
}
