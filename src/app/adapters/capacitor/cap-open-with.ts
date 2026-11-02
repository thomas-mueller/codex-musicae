import type { OpenedFile } from '../../ports/file-access';
import type { OpenWith } from '../../ports/open-with';
import { DocumentAccess } from './document-access-plugin';
import type { DocumentAccessApi, NativeFile } from './document-access-plugin';

/** Reads one incoming file into an `OpenedFile`; null when it cannot be read. */
export type IncomingReader = (file: NativeFile) => Promise<OpenedFile | null>;

/**
 * FIL-018: files handed over by an Android VIEW intent. The native side queues them; this adapter drains the queue when a
 * listener registers (cold start) and again whenever the `incomingFile` event says a new one arrived.
 * UNVERIFIED(device): needs a device ("Open with" from the Files app).
 */
export class CapOpenWith implements OpenWith {
  private readonly callbacks = new Set<(files: readonly OpenedFile[]) => void>();
  private listening = false;

  constructor(
    private readonly read: IncomingReader,
    private readonly plugin: DocumentAccessApi = DocumentAccess,
  ) {}

  onIncomingFiles(callback: (files: readonly OpenedFile[]) => void): () => void {
    this.callbacks.add(callback);
    if (!this.listening) {
      this.listening = true;
      void this.plugin.addListener('incomingFile', () => void this.drain());
    }
    void this.drain();
    return () => this.callbacks.delete(callback);
  }

  private async drain(): Promise<void> {
    let pending: NativeFile[];
    try {
      pending = (await this.plugin.getPendingIncoming()).files;
    } catch {
      return;
    }
    const opened: OpenedFile[] = [];
    for (const file of pending) {
      const read = await this.read(file);
      if (read) {
        opened.push(read);
      }
    }
    if (opened.length > 0) {
      for (const callback of [...this.callbacks]) {
        callback(opened);
      }
    }
  }
}
