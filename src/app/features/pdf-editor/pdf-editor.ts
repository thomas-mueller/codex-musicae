import {
  AfterViewInit,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist';
import { MusicSystemService } from '../../core/pdf/music-system.service';
import { orderMusicSystems, type MusicSystem } from '../../core/pdf/music-system.model';
import { drawMusicSystems } from '../../core/pdf/music-system-renderer';
import { PdfCanvasStage, type PageNavigationAction } from '../../shared/components/pdf-canvas-stage/pdf-canvas-stage';
import { PdfStateService } from '../../core/pdf/pdf-state.service';
import { PdfPersistenceService } from '../../core/pdf/pdf-persistence.service';
import { AppIcon } from '../../shared/components/app-icon/app-icon';
import type { MusicSystemOverlayLabel } from '../../core/pdf/music-system-renderer';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-editor',
  templateUrl: './pdf-editor.html',
  styleUrl: './pdf-editor.css',
  standalone: true,
  imports: [CommonModule, PdfCanvasStage, AppIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfEditor implements AfterViewInit, OnDestroy {
  @ViewChild('pdfViewport')
  private pdfViewportRef!: ElementRef<HTMLDivElement>;

  @ViewChild('pdfCanvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  pdfUrl: string;
  currentPage = 1;
  pageCount = 0;
  zoom = 1;
  loading = true;
  errorMessage = '';

  private pdfDocument?: pdfjsLib.PDFDocumentProxy;
  private loadingTask?: pdfjsLib.PDFDocumentLoadingTask;
  private renderTask?: pdfjsLib.RenderTask;
  private resizeObserver?: ResizeObserver;
  private destroyed = false;
  private renderSequence = 0;
  private detectionController?: AbortController;
  private lastViewportSize = '';
  private resizeFrame?: number;

  constructor(
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
    private readonly musicSystemService: MusicSystemService,
    private readonly pdfState: PdfStateService,
    private readonly pdfPersistence: PdfPersistenceService,
  ) { this.pdfUrl = this.pdfState.pdfUrl(); }

  get musicSystems() { return this.musicSystemService.musicSystems; }
  get padding() { return this.musicSystemService.padding; }
  get saveStatus() { return this.pdfPersistence.saveStatus; }
  get isSaving() { return this.pdfPersistence.saveStatus() === 'saving'; }

  async ngAfterViewInit(): Promise<void> {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeFrame !== undefined) {
        cancelAnimationFrame(this.resizeFrame);
      }
      this.resizeFrame = requestAnimationFrame(() => {
        this.resizeFrame = undefined;
        const viewport = this.pdfViewportRef.nativeElement;
        const size = `${viewport.clientWidth}x${viewport.clientHeight}`;
        if (size !== this.lastViewportSize) {
          this.lastViewportSize = size;
          void this.renderCurrentPage();
        }
      });
    });
    this.resizeObserver.observe(this.pdfViewportRef.nativeElement);

    await this.loadDocument();
  }

  private async loadDocument(): Promise<void> {
    this.loading = true; this.errorMessage = ''; this.currentPage = 1; this.pageCount = 0;
    this.musicSystemService.clearEditorState();
    this.renderTask?.cancel(); await this.loadingTask?.destroy();
    try {
      const loadingTask = pdfjsLib.getDocument({
        url: this.pdfUrl,
        cMapUrl: '/assets/pdfjs-dist/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/assets/pdfjs-dist/standard_fonts/',
        wasmUrl: '/assets/pdfjs-dist/wasm/',
      });
      this.loadingTask = loadingTask;
      this.pdfDocument = await loadingTask.promise;
      if (this.destroyed) {
        await loadingTask.destroy();
        return;
      }

      this.pageCount = this.pdfDocument.numPages;
      this.loading = false;
      this.changeDetector.markForCheck();

      // Check if the PDF has embedded settings
      let hasEmbeddedSettings = false;
      const cachedBytes = this.pdfState.pdfBytes();
      if (cachedBytes) {
        const extracted = await this.pdfPersistence.loadAndExtractSettings(cachedBytes);
        if (extracted) {
          hasEmbeddedSettings = true;
          this.changeDetector.markForCheck();
        }
      } else {
        try {
          const response = await fetch(this.pdfUrl);
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          this.pdfState.pdfBytes.set(bytes);
          const extracted = await this.pdfPersistence.loadAndExtractSettings(bytes);
          if (extracted) {
            hasEmbeddedSettings = true;
            this.changeDetector.markForCheck();
          }
        } catch {
          // If fetch fails or has no embedded settings, continue with detection
        }
      }

      if (!hasEmbeddedSettings) {
        this.detectionController?.abort();
        this.detectionController = new AbortController();
        void this.detectDocumentMusicSystems(this.pdfDocument, this.detectionController.signal);
      }

      await this.renderCurrentPage();
    } catch {
      if (!this.destroyed) {
        this.loading = false;
        this.errorMessage = 'Unable to load this PDF.';
        this.changeDetector.markForCheck();
      }
    }
  }

  openFile(file: File): void {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) return;
    this.pdfState.openFile(file); this.pdfUrl = this.pdfState.pdfUrl(); void this.loadDocument();
  }

  async savePdf(): Promise<void> {
    await this.pdfPersistence.save();
    this.changeDetector.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.detectionController?.abort();
    this.resizeObserver?.disconnect();
    if (this.resizeFrame !== undefined) {
      cancelAnimationFrame(this.resizeFrame);
    }
    this.renderTask?.cancel();
    void this.loadingTask?.destroy();
  }

  private async detectDocumentMusicSystems(
    document: pdfjsLib.PDFDocumentProxy,
    signal: AbortSignal,
  ): Promise<void> {
    const detectedByPage = new Map<number, readonly MusicSystem[]>();
    try {
      await this.musicSystemService.detectMusicSystemsInDocument(document, {
        signal,
        initialPage: this.currentPage,
        onPageDetected: (musicSystems, page) => {
          if (this.destroyed || signal.aborted) {
            return;
          }
          detectedByPage.set(page, musicSystems);
          this.musicSystemService.setEditorState(
            orderMusicSystems(Array.from(detectedByPage.values()).flat()),
            this.padding(),
          );
          this.changeDetector.markForCheck();
          if (page === this.currentPage) {
            void this.renderCurrentPage();
          }
        },
      });
      if (this.destroyed) {
        return;
      }
    } catch (error) {
      if (!this.destroyed && !(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Unable to detect PDF music systems.', error);
      }
    }
  }

  get canGoToPreviousPage(): boolean {
    return this.currentPage > 1;
  }

  get canGoToNextPage(): boolean {
    return this.currentPage < this.pageCount;
  }

  previousPage(): void {
    if (this.canGoToPreviousPage) {
      this.currentPage -= 1;
      void this.renderCurrentPage();
    }
  }

  nextPage(): void {
    if (this.canGoToNextPage) {
      this.currentPage += 1;
      void this.renderCurrentPage();
    }
  }

  firstPage(): void {
    this.goToPage(1);
  }

  lastPage(): void {
    this.goToPage(this.pageCount);
  }

  handleNavigation(action: PageNavigationAction): void {
    if (action === 'previous') this.previousPage();
    else if (action === 'next') this.nextPage();
    else if (action === 'first') this.firstPage();
    else this.lastPage();
  }

  private goToPage(page: number): void {
    const target = Math.max(1, Math.min(page, this.pageCount));
    if (target !== this.currentPage && this.pageCount > 0) {
      this.currentPage = target;
      void this.renderCurrentPage();
    }
  }

  zoomOut(): void {
    this.setZoom(this.zoom - 0.25);
  }

  zoomIn(): void {
    this.setZoom(this.zoom + 0.25);
  }

  navigateToViewer(): void {
    this.musicSystemService.setEditorState(this.musicSystems(), this.padding());
    void this.router.navigate(['/viewer']);
  }

  setPadding(value: number | string): void {
    const parsed = typeof value === 'string' ? Number(value) : value;
    this.musicSystemService.padding.set(Math.max(0, Math.min(Number.isFinite(parsed) ? parsed : 0.025, 0.5)));
    void this.renderCurrentPage();
  }

  private setZoom(zoom: number): void {
    this.zoom = Math.max(0.5, Math.min(zoom, 3));
    void this.renderCurrentPage();
  }

  private async renderCurrentPage(): Promise<void> {
    const document = this.pdfDocument;
    if (!document || this.destroyed) {
      return;
    }

    const sequence = ++this.renderSequence;
    this.renderTask?.cancel();
    this.renderTask = undefined;
    this.errorMessage = '';

    try {
      const page = await document.getPage(this.currentPage);
      if (this.destroyed || sequence !== this.renderSequence) {
        return;
      }

      const viewportElement = this.pdfViewportRef.nativeElement;
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = Math.min(
        viewportElement.clientWidth / baseViewport.width,
        viewportElement.clientHeight / baseViewport.height,
      );
      const displayScale = Math.max(0.1, fitScale * this.zoom);
      const outputScale = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: displayScale * outputScale });
      const canvas = this.canvasRef.nativeElement;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas rendering is unavailable.');
      }

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / outputScale)}px`;
      canvas.style.height = `${Math.floor(viewport.height / outputScale)}px`;

      const task = page.render({ canvas, canvasContext: context, viewport });
      this.renderTask = task;
      await task.promise;
      if (sequence === this.renderSequence) {
        this.renderTask = undefined;
        try {
          drawMusicSystems(context, this.currentPage, this.musicSystems(), canvas.width, canvas.height, this.padding(), this.getOverlayLabels());
        } catch (error) {
          console.error('Unable to draw PDF editor overlays.', error);
        }
      }
    } catch (error) {
      if (
        !this.destroyed &&
        sequence === this.renderSequence &&
        !(error instanceof Error && error.name === 'RenderingCancelledException')
      ) {
        this.errorMessage = 'Unable to render this PDF page.';
        this.changeDetector.markForCheck();
      }
    }
  }

  private getOverlayLabels(): MusicSystemOverlayLabel[] {
    return orderMusicSystems(this.musicSystems())
      .map((musicSystem) => ({ ...musicSystem, boxNumber: musicSystem.boxOrder! }));
  }
}
