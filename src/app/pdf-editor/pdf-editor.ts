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
import {
  type BoundingBox,
  detectBoundingBoxesInDocument,
  drawBoundingBoxes,
} from './bounding-boxes';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-editor',
  templateUrl: './pdf-editor.html',
  styleUrl: './pdf-editor.css',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfEditor implements AfterViewInit, OnDestroy {
  @ViewChild('pdfViewport')
  private pdfViewportRef!: ElementRef<HTMLDivElement>;

  @ViewChild('pdfCanvas')
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly pdfUrl = '/pdfs/test.pdf';
  currentPage = 1;
  pageCount = 0;
  zoom = 1;
  loading = true;
  errorMessage = '';
  boundingBoxes: BoundingBox[] = [];

  private pdfDocument?: pdfjsLib.PDFDocumentProxy;
  private loadingTask?: pdfjsLib.PDFDocumentLoadingTask;
  private renderTask?: pdfjsLib.RenderTask;
  private resizeObserver?: ResizeObserver;
  private destroyed = false;
  private renderSequence = 0;

  constructor(
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  async ngAfterViewInit(): Promise<void> {
    this.resizeObserver = new ResizeObserver(() => {
      void this.renderCurrentPage();
    });
    this.resizeObserver.observe(this.pdfViewportRef.nativeElement);

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
      void this.detectDocumentBoundingBoxes(this.pdfDocument);
      await this.renderCurrentPage();
    } catch {
      if (!this.destroyed) {
        this.loading = false;
        this.errorMessage = 'Unable to load this PDF.';
        this.changeDetector.markForCheck();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
    this.renderTask?.cancel();
    void this.loadingTask?.destroy();
  }

  private async detectDocumentBoundingBoxes(
    document: pdfjsLib.PDFDocumentProxy,
  ): Promise<void> {
    try {
      const boxes = await detectBoundingBoxesInDocument(document);
      if (this.destroyed) {
        return;
      }

      this.boundingBoxes = boxes;
      this.changeDetector.markForCheck();
      void this.renderCurrentPage();
    } catch (error) {
      if (!this.destroyed) {
        console.error('Unable to detect PDF bounding boxes.', error);
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

  zoomOut(): void {
    this.setZoom(this.zoom - 0.25);
  }

  zoomIn(): void {
    this.setZoom(this.zoom + 0.25);
  }

  navigateToViewer(): void {
    void this.router.navigate(['/viewer']);
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
        drawBoundingBoxes(
          context,
          this.currentPage,
          this.boundingBoxes,
          canvas.width,
          canvas.height,
        );
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
}
