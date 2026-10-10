import { Component, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist';
import { PdfStateService } from '../pdf-state.service';
import { MusicSystemService } from '../pdf/music-system.service';
import { buildSlideGroups, type PageSize, type SlideGroup } from '../pdf-slides';
import { PdfCanvasStage } from '../pdf-canvas-stage';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

@Component({ selector: 'app-pdf-slides-viewer', templateUrl: './pdf-slides-viewer.html', styleUrl: './pdf-slides-viewer.css', standalone: true, imports: [PdfCanvasStage] })
export class PdfSlidesViewer implements AfterViewInit, OnDestroy {
  @ViewChild('pdfContainer') pdfContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('pdfCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  readonly pdfUrl: string;
  loading = true; errorMessage = ''; currentSlide = 0; slideGroups: SlideGroup[] = [];
  private pdfDocument?: pdfjsLib.PDFDocumentProxy; private loadingTask?: pdfjsLib.PDFDocumentLoadingTask;
  private resizeObserver?: ResizeObserver; private destroyed = false; private pageSizes: PageSize[] = []; private renderSequence = 0; private activeRenderTask?: pdfjsLib.RenderTask;
  private lastContainerSize = ''; private resizeFrame?: number;

  constructor(private readonly router: Router, private readonly changeDetector: ChangeDetectorRef, private readonly pdfState: PdfStateService, private readonly musicSystemService: MusicSystemService) { this.pdfUrl = pdfState.pdfUrl; }
  get canGoPrevious(): boolean { return this.currentSlide > 0; }
  get canGoNext(): boolean { return this.currentSlide + 1 < this.slideGroups.length; }

  async ngAfterViewInit(): Promise<void> {
    await Promise.resolve();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResizeRebuild());
      this.resizeObserver.observe(this.pdfContainerRef.nativeElement);
    }
    if (!this.musicSystemService.hasEditorState()) { this.loading = false; this.errorMessage = 'Open the PDF in the editor first to generate slides.'; this.changeDetector.markForCheck(); return; }
    try {
      this.loadingTask = pdfjsLib.getDocument({ url: this.pdfUrl, cMapUrl: '/assets/pdfjs-dist/cmaps/', cMapPacked: true, standardFontDataUrl: '/assets/pdfjs-dist/standard_fonts/', wasmUrl: '/assets/pdfjs-dist/wasm/' });
      this.pdfDocument = await this.loadingTask.promise;
      for (let i = 1; i <= this.pdfDocument.numPages; i++) { const page = await this.pdfDocument.getPage(i); const viewport = page.getViewport({ scale: 1 }); this.pageSizes.push({ width: viewport.width, height: viewport.height }); }
      this.loading = false; await this.rebuildSlides();
    } catch (error) { if (!this.destroyed) { console.error('Unable to load slides PDF.', error); this.loading = false; this.errorMessage = 'Unable to display this PDF.'; this.changeDetector.markForCheck(); } }
  }
  ngOnDestroy(): void { this.destroyed = true; this.resizeObserver?.disconnect(); if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame); this.activeRenderTask?.cancel(); void this.loadingTask?.destroy(); }
  previousSlide(): void { if (this.canGoPrevious) { this.currentSlide--; void this.renderCurrentSlide(); } }
  nextSlide(): void { if (this.canGoNext) { this.currentSlide++; void this.renderCurrentSlide(); } }
  backToEditor(): void { void this.router.navigate(['/editor']); }

  private scheduleResizeRebuild(): void {
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      const container = this.pdfContainerRef.nativeElement;
      const size = `${container.clientWidth}x${container.clientHeight}`;
      if (size === this.lastContainerSize) return;
      this.lastContainerSize = size;
      void this.rebuildSlides();
    });
  }

  private async rebuildSlides(): Promise<void> {
    if (!this.pdfDocument || this.destroyed || !this.pageSizes.length) return;
    const container = this.pdfContainerRef.nativeElement; const aspect = container.clientHeight ? container.clientWidth / container.clientHeight : 1.5;
    this.slideGroups = buildSlideGroups(this.musicSystemService.musicSystems(), this.pageSizes, this.musicSystemService.padding(), aspect); this.currentSlide = Math.min(this.currentSlide, Math.max(0, this.slideGroups.length - 1)); this.changeDetector.markForCheck(); await this.renderCurrentSlide();
  }

  private async renderCurrentSlide(): Promise<void> {
    const document = this.pdfDocument; const group = this.slideGroups[this.currentSlide]; if (!document || !group || this.destroyed) return;
    const sequence = ++this.renderSequence; this.activeRenderTask?.cancel(); this.activeRenderTask = undefined; const outputScale = window.devicePixelRatio || 1; const width = Math.max(...group.map((r) => r.xMax - r.xMin)); const height = group.reduce((sum, r) => sum + r.yMax - r.yMin, 0); const container = this.pdfContainerRef.nativeElement; const scale = Math.min(container.clientWidth / width, container.clientHeight / height);
    const canvas = this.canvasRef.nativeElement; canvas.width = Math.max(1, Math.floor(width * scale * outputScale)); canvas.height = Math.max(1, Math.floor(height * scale * outputScale)); canvas.style.width = `${Math.floor(width * scale)}px`; canvas.style.height = `${Math.floor(height * scale)}px`; const context = canvas.getContext('2d'); if (!context) return; context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
    let y = 0;
    try {
      for (const rect of group) {
        const page = await document.getPage(rect.pageIndex + 1); const viewport = page.getViewport({ scale: scale * outputScale }); const source = globalThis.document.createElement('canvas'); source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height); const sourceContext = source.getContext('2d'); if (!sourceContext) continue; const task = page.render({ canvas: source, canvasContext: sourceContext, viewport }); this.activeRenderTask = task; await task.promise; if (sequence !== this.renderSequence) return;
        const rectWidth = rect.xMax - rect.xMin; const rectHeight = rect.yMax - rect.yMin; const x = (width - rectWidth) * scale * outputScale / 2; context.drawImage(source, rect.xMin * scale * outputScale, rect.yMin * scale * outputScale, rectWidth * scale * outputScale, rectHeight * scale * outputScale, x, y * scale * outputScale, rectWidth * scale * outputScale, rectHeight * scale * outputScale); y += rectHeight;
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === 'RenderingCancelledException')) throw error;
    } finally {
      if (sequence === this.renderSequence) this.activeRenderTask = undefined;
    }
  }
  @HostListener('window:keydown', ['$event']) onKeyDown(event: KeyboardEvent): void { if (event.key === 'ArrowLeft') this.previousSlide(); if (event.key === 'ArrowRight') this.nextSlide(); }
}
