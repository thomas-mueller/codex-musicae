import { signal } from '@angular/core';

import type { Point } from '../core';
import type { PdfDocumentHandle, PdfOpenError, PdfPageInfo, PdfRenderer } from '../ports/pdf-renderer';

export type DocumentStatus = 'loading' | 'ready' | 'error';
export type DocumentErrorCode = PdfOpenError;

/**
 * One per tab (FIL-005). Holds the pdf.js handle and lightweight page data; later milestones add position,
 * zoom, marks. Never keeps the PDF bytes (FIL-015).
 */
export class DocumentStore {
  private readonly handleSignal = signal<PdfDocumentHandle | null>(null);
  private readonly pageInfosSignal = signal<readonly PdfPageInfo[]>([]);
  private readonly statusSignal = signal<DocumentStatus>('loading');
  private readonly errorCodeSignal = signal<DocumentErrorCode | null>(null);

  /** Status markers of FIL-003; set by later milestones (saving, read-only files, lost access). */
  readonly unsaved = signal(false);
  readonly readOnly = signal(false);
  readonly needsReopen = signal(false);

  /** Organization mode view state, kept per tab (ORG-006): zoom relative to the default fit (fit-page), scroll offset in CSS px. */
  readonly orgZoom = signal(1);
  readonly orgScroll = signal<Point>({ x: 0, y: 0 });

  readonly handle = this.handleSignal.asReadonly();
  readonly pageInfos = this.pageInfosSignal.asReadonly();
  readonly status = this.statusSignal.asReadonly();
  readonly errorCode = this.errorCodeSignal.asReadonly();

  constructor(
    readonly tabId: string,
    private readonly renderer: PdfRenderer,
  ) {}

  /** FIL-009: never throws; failures end in status 'error' with a code. */
  async load(bytes: Uint8Array): Promise<void> {
    const opened = await this.renderer.open(bytes);
    if (!opened.ok) {
      this.fail(opened.error);
      return;
    }
    const handle = opened.value;
    const infos: PdfPageInfo[] = [];
    for (let i = 0; i < handle.pageCount; i++) {
      const info = await handle.getPageInfo(i);
      if (!info.ok) {
        await handle.destroy();
        this.fail('unknown');
        return;
      }
      infos.push(info.value);
    }
    this.handleSignal.set(handle);
    this.pageInfosSignal.set(infos);
    this.statusSignal.set('ready');
  }

  async dispose(): Promise<void> {
    const handle = this.handleSignal();
    this.handleSignal.set(null);
    await handle?.destroy();
  }

  private fail(code: DocumentErrorCode): void {
    this.errorCodeSignal.set(code);
    this.statusSignal.set('error');
  }
}
