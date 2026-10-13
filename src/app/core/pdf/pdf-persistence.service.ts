import { Injectable, signal, OnDestroy, Optional } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import { App } from '@capacitor/app';
import { PdfStateService } from './pdf-state.service';
import { MusicSystemService } from './music-system.service';
import { drawAnnotationsInPdf, embedSettingsInPdf, extractSettingsFromPdf } from './pdf-embed.util';
import { PdfAnnotationService } from './pdf-annotation.service';
import type { CodexPdfSettings } from './pdf-settings.model';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

@Injectable({ providedIn: 'root' })
export class PdfPersistenceService implements OnDestroy {
  readonly saveStatus = signal<SaveStatus>('idle');
  readonly lastSavedAt = signal<Date | null>(null);

  // Configurable interval (default 10 minutes = 600,000 ms)
  private saveIntervalMs = 10 * 60 * 1000;
  private intervalTimerId?: ReturnType<typeof setInterval>;
  private appStateListener?: { remove: () => Promise<void> };
  private statusResetTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly pdfState: PdfStateService,
    private readonly musicSystemService: MusicSystemService,
    @Optional() private readonly annotations?: PdfAnnotationService,
  ) {
    this.initAutoSave();
  }

  setIntervalMinutes(minutes: number): void {
    this.saveIntervalMs = Math.max(1, minutes) * 60 * 1000;
    this.restartIntervalTimer();
  }

  getIntervalMinutes(): number {
    return Math.round(this.saveIntervalMs / 60000);
  }

  private initAutoSave(): void {
    this.restartIntervalTimer();

    // On native Android / iOS, register lifecycle listener to auto-save when backgrounding or closing
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          void this.save({ silent: true });
        }
      }).then((listener) => {
        this.appStateListener = listener;
      }).catch((err) => console.warn('Could not register Capacitor appStateChange listener', err));
    }
  }

  private restartIntervalTimer(): void {
    if (this.intervalTimerId) {
      clearInterval(this.intervalTimerId);
    }
    this.intervalTimerId = setInterval(() => {
      // Auto-save silently on interval (primarily for native platform where silent save is non-disruptive)
      if (Capacitor.isNativePlatform()) {
        void this.save({ silent: true });
      }
    }, this.saveIntervalMs);
  }

  async loadAndExtractSettings(pdfBytes: Uint8Array): Promise<CodexPdfSettings | null> {
    const settings = await extractSettingsFromPdf(pdfBytes);
    if (settings) {
      this.musicSystemService.setEditorState(
        settings.musicSystems,
        settings.padding,
        settings.aspectRatio ?? 0,
      );
    }
    return settings;
  }

  async save(options: { silent?: boolean } = {}): Promise<boolean> {
    let bytes = this.pdfState.pdfBytes();
    if (!bytes) {
      // If pdfBytes wasn't cached yet, fetch from pdfUrl
      try {
        const response = await fetch(this.pdfState.pdfUrl());
        const buffer = await response.arrayBuffer();
        bytes = new Uint8Array(buffer);
        this.pdfState.pdfBytes.set(bytes);
      } catch (err) {
        console.error('Failed to read PDF bytes for saving', err);
        if (!options.silent) this.setTransientStatus('error');
        return false;
      }
    }

    if (!options.silent) {
      this.saveStatus.set('saving');
    }

    try {
      const settings: CodexPdfSettings = {
        version: 1,
        updatedAt: new Date().toISOString(),
        padding: this.musicSystemService.padding(),
        aspectRatio: this.musicSystemService.aspectRatio() ?? 1.5,
        musicSystems: [...this.musicSystemService.musicSystems()],
      };

      const annotatedBytes = await drawAnnotationsInPdf(bytes, this.annotations?.strokes() ?? []);
      const updatedBytes = await embedSettingsInPdf(annotatedBytes, settings);
      this.pdfState.setDocumentBytes(updatedBytes);

      if (Capacitor.isNativePlatform()) {
        await this.saveToNativeFilesystem(updatedBytes);
      } else {
        if (!options.silent) {
          this.triggerBrowserDownload(updatedBytes, this.pdfState.pdfName());
        }
      }

      this.lastSavedAt.set(new Date());
      if (!options.silent) {
        this.setTransientStatus('saved');
      }
      this.annotations?.markSaved();
      return true;
    } catch (error) {
      console.error('Failed to save PDF settings', error);
      if (!options.silent) {
        this.setTransientStatus('error');
      }
      return false;
    }
  }

  private async saveToNativeFilesystem(bytes: Uint8Array): Promise<void> {
    const nativePath = this.pdfState.nativeFilePath();
    if (nativePath) {
      // Convert bytes to base64
      const base64Data = this.uint8ArrayToBase64(bytes);
      await Filesystem.writeFile({
        path: nativePath,
        data: base64Data,
      });
    }
  }

  private triggerBrowserDownload(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private setTransientStatus(status: SaveStatus): void {
    this.saveStatus.set(status);
    if (this.statusResetTimer) clearTimeout(this.statusResetTimer);
    this.statusResetTimer = setTimeout(() => {
      this.saveStatus.set('idle');
    }, 2500);
  }

  ngOnDestroy(): void {
    if (this.intervalTimerId) clearInterval(this.intervalTimerId);
    if (this.statusResetTimer) clearTimeout(this.statusResetTimer);
    if (this.appStateListener) {
      void this.appStateListener.remove();
    }
  }
}
