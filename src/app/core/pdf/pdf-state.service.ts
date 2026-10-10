import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class PdfStateService {
  readonly pdfUrl = signal('/pdfs/test.pdf');
  readonly pdfName = signal('test.pdf');
  private objectUrl?: string;

  openFile(file: File): void {
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.pdfUrl.set(this.objectUrl);
    this.pdfName.set(file.name);
  }

  openExternally(): void {
    window.open(this.pdfUrl(), '_blank', 'noopener,noreferrer');
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}
