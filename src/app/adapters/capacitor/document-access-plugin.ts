import { registerPlugin } from '@capacitor/core';

/** A file reference as the native plugin describes it. */
export interface NativeFile {
  readonly id: string;
  readonly name: string;
  readonly size?: number;
  readonly lastModified?: number;
  readonly writable: boolean;
}

/**
 * The native `DocumentAccessPlugin` (android/app/src/main/java/app/web/codexmusicae/DocumentAccessPlugin.java).
 * Rejections carry a `code` equal to a `FileAccessError` value.
 */
export interface DocumentAccessApi {
  /** An empty list means the user cancelled. */
  pickDocuments(options: { multiple: boolean }): Promise<{ files: NativeFile[] }>;
  openRead(options: { id: string }): Promise<{ handle: string; size: number; writable: boolean }>;
  /** `data` is base64 and may be shorter than `length` at the end of the file. */
  readChunk(options: { handle: string; offset: number; length: number }): Promise<{ data: string }>;
  closeRead(options: { handle: string }): Promise<void>;
  openWrite(options: { id: string }): Promise<{ handle: string }>;
  writeChunk(options: { handle: string; data: string }): Promise<void>;
  /** Copies the temp file over the target in one native loop (LIM-011). */
  commitWrite(options: { handle: string }): Promise<void>;
  abortWrite(options: { handle: string }): Promise<void>;
  /** No `id` means the user cancelled. */
  createDocument(options: { name: string }): Promise<{ id?: string }>;
  isPersisted(options: { id: string }): Promise<{ persisted: boolean }>;
  forget(options: { id: string }): Promise<void>;
  /** Files queued by VIEW intents; the queue is emptied. */
  getPendingIncoming(): Promise<{ files: NativeFile[] }>;
  /** Fires when a VIEW intent queued a file; the listener answers with `getPendingIncoming`. */
  addListener(event: 'incomingFile', listener: () => void): Promise<{ remove(): Promise<void> }>;
}

export const DocumentAccess = registerPlugin<DocumentAccessApi>('DocumentAccess');
