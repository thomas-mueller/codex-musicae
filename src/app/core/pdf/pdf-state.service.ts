import { Injectable, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class PdfStateService {
  readonly pdfUrl = signal('/pdfs/test.pdf');
  readonly pdfName = signal('test.pdf');
  readonly pdfBytes = signal<Uint8Array | null>(null);
  readonly nativeFilePath = signal<string | null>(null);
  private objectUrl?: string;

  openFile(file: File, bytes?: Uint8Array): void {
    this.revokeObjectUrl();
    this.objectUrl = URL.createObjectURL(file);
    this.pdfUrl.set(this.objectUrl);
    this.pdfName.set(file.name);
    if (bytes) {
      this.pdfBytes.set(bytes);
    } else {
      file.arrayBuffer().then((buffer) => {
        this.pdfBytes.set(new Uint8Array(buffer));
      }).catch((err) => console.warn('Could not read file arrayBuffer', err));
    }
  }

  setDocumentBytes(bytes: Uint8Array, name?: string): void {
    this.revokeObjectUrl();
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    this.objectUrl = URL.createObjectURL(blob);
    this.pdfUrl.set(this.objectUrl);
    this.pdfBytes.set(bytes);
    if (name) this.pdfName.set(name);
  }

  setNativeFilePath(path: string | null): void {
    this.nativeFilePath.set(path);
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = undefined;
  }
}
