import { TUNABLES } from '../../../config/tunables';
import type { FileAccess, FileAccessError, FileRef, OpenedFile } from '../../ports/file-access';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import { decodeBase64Into, encodeBase64 } from './base64';
import { DocumentAccess } from './document-access-plugin';
import type { DocumentAccessApi, NativeFile } from './document-access-plugin';

const READ_ERRORS: readonly FileAccessError[] = ['denied', 'not-found', 'read-failed', 'cancelled', 'unsupported'];

/** Rejections of the native plugin carry the `FileAccessError` as `code`. */
function readErrorOf(e: unknown): FileAccessError {
  const code = (e as { code?: unknown } | null)?.code;
  return READ_ERRORS.find((known) => known === code) ?? 'read-failed';
}

function refOf(file: NativeFile): FileRef {
  return { id: file.id, name: file.name, size: file.size, lastModified: file.lastModified };
}

/**
 * PLT-008, FIL-018: Storage Access Framework through the native `DocumentAccessPlugin`. Files are transferred in chunks of
 * `T:resources.fileChunkBytes`, awaiting each bridge call, so a large transfer never blocks the UI.
 * UNVERIFIED(device): the native side can only be tested on a device (docs/device-checklist.md).
 */
export class CapFileAccess implements FileAccess {
  constructor(
    private readonly plugin: DocumentAccessApi = DocumentAccess,
    private readonly chunkBytes: number = TUNABLES.resources.fileChunkBytes,
  ) {}

  async pickPdfs(): Promise<Result<readonly OpenedFile[], FileAccessError>> {
    let files: NativeFile[];
    try {
      files = (await this.plugin.pickDocuments({ multiple: true })).files;
      // eslint-disable-next-line no-console -- TEMPORARY diagnostic
      console.log('CM-DIAG pickDocuments ->', JSON.stringify(files));
    } catch (e) {
      // eslint-disable-next-line no-console -- TEMPORARY diagnostic
      console.log('CM-DIAG pickDocuments rejected', JSON.stringify(e), String(e));
      return err(readErrorOf(e));
    }
    if (files.length === 0) {
      return err('cancelled');
    }
    const opened: OpenedFile[] = [];
    for (const file of files) {
      const content = await this.readAll(file.id);
      // eslint-disable-next-line no-console -- TEMPORARY diagnostic
      console.log('CM-DIAG readAll ->', content.ok ? `ok ${content.value.bytes.length}` : `error ${content.error}`);
      if (!content.ok) {
        return err(content.error);
      }
      opened.push({ ref: refOf(file), bytes: content.value.bytes, writable: file.writable });
    }
    return ok(opened);
  }

  /** `not-found` for an unknown id, `denied` when the persisted permission is gone (both reported by the plugin). */
  async reopen(ref: FileRef): Promise<Result<OpenedFile, FileAccessError>> {
    const content = await this.readAll(ref.id);
    if (!content.ok) {
      return err(content.error);
    }
    return ok({ ref: { ...ref, size: content.value.bytes.length }, bytes: content.value.bytes, writable: content.value.writable });
  }

  /** A file the native side described (a VIEW intent): its bytes and its writability as the plugin reports it. */
  async openIncoming(file: NativeFile): Promise<OpenedFile | null> {
    const content = await this.readAll(file.id);
    return content.ok ? { ref: refOf(file), bytes: content.value.bytes, writable: file.writable } : null;
  }

  async write(ref: FileRef, bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    return this.writeTo(ref.id, bytes);
  }

  /** Android decides write access at pick time (or through the VIEW intent); there is nothing to ask for later. */
  requestWriteAccess(): Promise<Result<void, FileAccessError>> {
    return Promise.resolve(err('unsupported'));
  }

  async saveCopy(suggestedName: string, bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    let id: string | undefined;
    try {
      id = (await this.plugin.createDocument({ name: suggestedName })).id;
    } catch {
      return err('write-failed');
    }
    if (id === undefined) {
      return err('cancelled');
    }
    try {
      return await this.writeTo(id, bytes);
    } finally {
      await this.forgetId(id);
    }
  }

  isSame(a: FileRef, b: FileRef): Promise<boolean> {
    return Promise.resolve(
      a.id === b.id ||
        (a.size !== undefined &&
          a.lastModified !== undefined &&
          a.name === b.name &&
          a.size === b.size &&
          a.lastModified === b.lastModified),
    );
  }

  forget(ref: FileRef): Promise<void> {
    return this.forgetId(ref.id);
  }

  private async forgetId(id: string): Promise<void> {
    try {
      await this.plugin.forget({ id });
    } catch {
      // The mapping is already gone.
    }
  }

  /** Assembles the chunks into one pre-sized array; only a single chunk exists as a base64 string at a time. */
  private async readAll(id: string): Promise<Result<{ bytes: Uint8Array; writable: boolean }, FileAccessError>> {
    let handle: string | null = null;
    try {
      const opened = await this.plugin.openRead({ id });
      handle = opened.handle;
      const bytes = new Uint8Array(opened.size);
      for (let offset = 0; offset < opened.size; ) {
        const length = Math.min(this.chunkBytes, opened.size - offset);
        const chunk = await this.plugin.readChunk({ handle, offset, length });
        const written = decodeBase64Into(chunk.data, bytes, offset);
        if (written === 0) {
          return err('read-failed');
        }
        offset += written;
      }
      return ok({ bytes, writable: opened.writable });
    } catch (e) {
      // eslint-disable-next-line no-console -- TEMPORARY diagnostic
      console.log('CM-DIAG readAll threw', JSON.stringify(e), String(e));
      return err(readErrorOf(e));
    } finally {
      if (handle !== null) {
        await this.plugin.closeRead({ handle }).catch(() => undefined);
      }
    }
  }

  /** Temp file first, then one native copy to the target: a failure before the commit leaves the original untouched. */
  private async writeTo(id: string, bytes: Uint8Array): Promise<Result<void, FileAccessError>> {
    let handle: string | null = null;
    try {
      handle = (await this.plugin.openWrite({ id })).handle;
      for (let offset = 0; offset < bytes.length; offset += this.chunkBytes) {
        await this.plugin.writeChunk({ handle, data: encodeBase64(bytes.subarray(offset, offset + this.chunkBytes)) });
      }
      await this.plugin.commitWrite({ handle });
      return ok(undefined);
    } catch {
      if (handle !== null) {
        await this.plugin.abortWrite({ handle }).catch(() => undefined);
      }
      return err('write-failed');
    }
  }
}
