import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

@Injectable({ providedIn: 'root' })
export class PdfDocumentService {
  private readonly documents = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>();

  load(url: string): Promise<pdfjsLib.PDFDocumentProxy> {
    let result = this.documents.get(url);
    if (!result) {
      const task = pdfjsLib.getDocument({ url, cMapUrl: '/assets/pdfjs-dist/cmaps/', cMapPacked: true,
        standardFontDataUrl: '/assets/pdfjs-dist/standard_fonts/', wasmUrl: '/assets/pdfjs-dist/wasm/' });
      result = task.promise;
      this.documents.set(url, result);
      void result.catch(() => this.documents.delete(url));
    }
    return result;
  }

  async clear(url: string): Promise<void> {
    const documentPromise = this.documents.get(url);
    this.documents.delete(url);
    if (documentPromise) {
      try { (await documentPromise).cleanup(); } catch { /* already cleaned up */ }
    }
  }
}
