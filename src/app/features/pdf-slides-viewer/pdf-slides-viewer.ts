import { Component, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist';
import { PdfStateService } from '../../core/pdf/pdf-state.service';
import { MusicSystemService } from '../../core/pdf/music-system.service';
import { buildSlideGroups, type PageSize, type SlideGroup } from '../../core/pdf/slide-groups';
import { PdfCanvasStage, type PageNavigationAction } from '../../shared/components/pdf-canvas-stage/pdf-canvas-stage';
import { AppIcon } from '../../shared/components/app-icon/app-icon';
import { orderMusicSystems, type MusicSystem } from '../../core/pdf/music-system.model';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

interface SlideAnchor {
  pageIndex: number;
  boxOrder?: number;
}

@Component({
  selector: 'app-pdf-slides-viewer',
  templateUrl: './pdf-slides-viewer.html',
  styleUrl: './pdf-slides-viewer.css',
  standalone: true,
  imports: [PdfCanvasStage, AppIcon],
})
export class PdfSlidesViewer implements AfterViewInit, OnDestroy {
  @ViewChild('viewerRoot') viewerRootRef!: ElementRef<HTMLElement>;
  @ViewChild('pdfContainer') pdfContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('pdfCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  pdfUrl: string;
  loading = true; errorMessage = ''; currentSlide = 0; slideGroups: SlideGroup[] = [];
  aspectRatioAdjustment = 0;
  private pdfDocument?: pdfjsLib.PDFDocumentProxy; private loadingTask?: pdfjsLib.PDFDocumentLoadingTask;
  private resizeObserver?: ResizeObserver; private destroyed = false; private pageSizes: PageSize[] = []; private renderSequence = 0; private activeRenderTask?: pdfjsLib.RenderTask;
  private detectionController?: AbortController; private readonly detectedByPage = new Map<number, readonly MusicSystem[]>();
  private lastContainerSize = ''; private resizeFrame?: number; private rebuildFrame?: number;
  private fullscreenExitRequested = false;

  constructor(private readonly router: Router, private readonly changeDetector: ChangeDetectorRef, private readonly pdfState: PdfStateService, private readonly musicSystemService: MusicSystemService) { this.pdfUrl = pdfState.pdfUrl(); }
  get canGoPrevious(): boolean { return this.currentSlide > 0; }
  get canGoNext(): boolean { return this.currentSlide + 1 < this.slideGroups.length; }
  get canZoomOut(): boolean { return this.selectedAspectRatio > 0.5 + 0.0001; }
  get canZoomIn(): boolean { return this.selectedAspectRatio < 2 - 0.0001; }
  get selectedAspectRatio(): number {
    const container = this.pdfContainerRef?.nativeElement;
    const baseAspectRatio = container?.clientHeight ? container.clientWidth / container.clientHeight : 1.5;
    return baseAspectRatio + this.aspectRatioAdjustment;
  }
  get selectedAspectRatioLabel(): string {
    const ratio = this.selectedAspectRatio;
    return Number.isFinite(ratio) && ratio > 0 ? Number(ratio.toFixed(2)).toString() : '—';
  }

  async ngAfterViewInit(): Promise<void> {
    await this.enterPresentationMode();
    await Promise.resolve();
    this.pageSizes = [];
    this.slideGroups = [];
    this.currentSlide = 0;
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResizeRebuild());
      this.resizeObserver.observe(this.pdfContainerRef.nativeElement);
    }
    if (!this.musicSystemService.hasEditorState()) { this.loading = false; this.errorMessage = 'Open the PDF in the editor first to generate slides.'; this.changeDetector.markForCheck(); return; }
    try {
      this.loadingTask = pdfjsLib.getDocument({ url: this.pdfUrl, cMapUrl: '/assets/pdfjs-dist/cmaps/', cMapPacked: true, standardFontDataUrl: '/assets/pdfjs-dist/standard_fonts/', wasmUrl: '/assets/pdfjs-dist/wasm/' });
      this.pdfDocument = await this.loadingTask.promise;
      this.pageSizes = [];
      for (let i = 1; i <= this.pdfDocument.numPages; i++) { const page = await this.pdfDocument.getPage(i); const viewport = page.getViewport({ scale: 1 }); this.pageSizes.push({ width: viewport.width, height: viewport.height }); }
      this.detectedByPage.clear();
      for (const musicSystem of this.musicSystemService.musicSystems()) {
        const pageSystems = this.detectedByPage.get(musicSystem.page) ?? [];
        this.detectedByPage.set(musicSystem.page, [...pageSystems, musicSystem]);
      }
      this.loading = false; await this.rebuildSlides();
      this.detectionController?.abort();
      this.detectionController = new AbortController();
      void this.detectRemainingPages(this.detectionController.signal);
    } catch (error) { if (!this.destroyed) { console.error('Unable to load slides PDF.', error); this.loading = false; this.errorMessage = 'Unable to display this PDF.'; this.changeDetector.markForCheck(); } }
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.detectionController?.abort();
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    this.resizeObserver?.disconnect(); if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame); if (this.rebuildFrame !== undefined) cancelAnimationFrame(this.rebuildFrame); this.activeRenderTask?.cancel(); void this.loadingTask?.destroy();
    void this.exitFullscreen();
  }
  previousSlide(): void { if (this.canGoPrevious) { this.currentSlide--; void this.renderCurrentSlide(); } }
  nextSlide(): void { if (this.canGoNext) { this.currentSlide++; void this.renderCurrentSlide(); } }
  firstSlide(): void { this.goToSlide(0); }
  lastSlide(): void { this.goToSlide(this.slideGroups.length - 1); }
  zoomOut(): void { this.setAspectRatio(Math.floor((this.selectedAspectRatio - 0.0001) * 10) / 10); }
  zoomIn(): void { this.setAspectRatio(Math.ceil((this.selectedAspectRatio + 0.0001) * 10) / 10); }
  handleNavigation(action: PageNavigationAction): void {
    if (action === 'previous') this.previousSlide();
    else if (action === 'next') this.nextSlide();
    else if (action === 'first') this.firstSlide();
    else this.lastSlide();
  }
  private goToSlide(slide: number): void {
    const target = Math.max(0, Math.min(slide, this.slideGroups.length - 1));
    if (this.slideGroups.length && target !== this.currentSlide) {
      this.currentSlide = target;
      void this.renderCurrentSlide();
    }
  }
  backToEditor(): void { void this.exitViewer(); }
  openFile(file: File): void { if (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) { this.pdfState.openFile(file); void this.exitViewer(); } }
  openExternally(): void { this.pdfState.openExternally(); }

  private setAspectRatio(aspectRatio: number): void {
    const container = this.pdfContainerRef?.nativeElement;
    const baseAspectRatio = container?.clientHeight ? container.clientWidth / container.clientHeight : 1.5;
    const nextAspectRatio = Math.max(0.5, Math.min(aspectRatio, 2));
    if (Math.abs(nextAspectRatio - this.selectedAspectRatio) < 0.0001) return;
    this.aspectRatioAdjustment = nextAspectRatio - baseAspectRatio;
    void this.rebuildSlides();
  }

  private async enterPresentationMode(): Promise<void> {
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    const element = this.viewerRootRef?.nativeElement;
    if (!element?.requestFullscreen || this.fullscreenExitRequested || document.fullscreenElement) return;
    try { await element.requestFullscreen(); } catch { /* Fullscreen is optional; the CSS layout remains usable. */ }
  }

  private readonly onFullscreenChange = (): void => {
    if (!document.fullscreenElement) {
      if (!this.fullscreenExitRequested && !this.destroyed) void this.router.navigate(['/editor']);
      this.fullscreenExitRequested = true;
    }
  };

  private async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch { /* The route is still allowed to change. */ }
    }
  }

  private async exitViewer(): Promise<void> {
    this.fullscreenExitRequested = true;
    this.detectionController?.abort();
    await this.exitFullscreen();
    await this.router.navigate(['/editor']);
  }

  private scheduleResizeRebuild(): void {
    if (this.resizeFrame !== undefined) cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      const container = this.pdfContainerRef.nativeElement;
      const size = `${container.clientWidth}x${container.clientHeight}`;
      if (size === this.lastContainerSize) return;
      this.lastContainerSize = size;
      this.scheduleRebuild();
    });
  }

  private scheduleRebuild(): void {
    if (this.rebuildFrame !== undefined) return;
    this.rebuildFrame = requestAnimationFrame(() => {
      this.rebuildFrame = undefined;
      void this.rebuildSlides();
    });
  }

  private async rebuildSlides(): Promise<void> {
    if (!this.pdfDocument || this.destroyed || !this.pageSizes.length) return;
    const anchor = this.getCurrentSlideAnchor();
    this.activeRenderTask?.cancel();
    this.activeRenderTask = undefined;
    ++this.renderSequence;
    const aspect = this.selectedAspectRatio;
    const container = this.pdfContainerRef.nativeElement;
    const viewportAspect = container.clientHeight ? container.clientWidth / container.clientHeight : aspect;
    const cropAspect = Math.max(aspect, viewportAspect);
    const systems = orderMusicSystems(Array.from(this.detectedByPage.values()).flat());
    this.slideGroups = buildSlideGroups(systems, this.pageSizes, this.musicSystemService.padding(), aspect, cropAspect);
    this.currentSlide = this.findSlideForAnchor(anchor);
    this.changeDetector.markForCheck();
    await this.renderCurrentSlide();
  }

  private async detectRemainingPages(signal: AbortSignal): Promise<void> {
    if (!this.pdfDocument) return;
    try {
      await this.musicSystemService.detectMusicSystemsInDocument(this.pdfDocument, {
        signal,
        initialPage: 1,
        onPageDetected: (systems, page) => {
          if (this.destroyed || signal.aborted) return;
          this.detectedByPage.set(page, systems);
          this.musicSystemService.setEditorState(
            orderMusicSystems(Array.from(this.detectedByPage.values()).flat()),
            this.musicSystemService.padding(),
          );
          this.scheduleRebuild();
        },
      });
    } catch (error) {
      if (!this.destroyed && !(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('Unable to continue PDF music-system detection in viewer.', error);
      }
    }
  }

  private getCurrentSlideAnchor(): SlideAnchor | undefined {
    const rect = this.slideGroups[this.currentSlide]?.[0];
    return rect ? { pageIndex: rect.pageIndex, boxOrder: rect.boxOrder } : undefined;
  }

  private findSlideForAnchor(anchor: SlideAnchor | undefined): number {
    if (!this.slideGroups.length) return 0;
    if (anchor) {
      const anchoredSlide = this.slideGroups.findIndex((group) => group.some((rect) =>
        rect.pageIndex === anchor.pageIndex &&
        (anchor.boxOrder === undefined || rect.boxOrder === anchor.boxOrder)));
      if (anchoredSlide >= 0) return anchoredSlide;
    }
    return Math.min(this.currentSlide, this.slideGroups.length - 1);
  }

  private async renderCurrentSlide(): Promise<void> {
    const document = this.pdfDocument; const group = this.slideGroups[this.currentSlide]; if (!document || !group || this.destroyed) return;
    const sequence = ++this.renderSequence; this.activeRenderTask?.cancel(); this.activeRenderTask = undefined; const outputScale = window.devicePixelRatio || 1; const width = group.renderWidth ?? Math.max(...group.map((r) => r.xMax - r.xMin)); const height = group.renderHeight ?? group.reduce((sum, r) => sum + r.yMax - r.yMin, 0); const container = this.pdfContainerRef.nativeElement; const scale = Math.min(container.clientWidth / width, container.clientHeight / height);
    const canvas = this.canvasRef.nativeElement; const renderedWidth = Math.max(1, Math.floor(width * scale * outputScale)); const renderedHeight = Math.max(1, Math.floor(height * scale * outputScale)); const offscreen = globalThis.document.createElement('canvas'); offscreen.width = renderedWidth; offscreen.height = renderedHeight; const context = offscreen.getContext('2d'); if (!context) return; context.fillStyle = 'white'; context.fillRect(0, 0, renderedWidth, renderedHeight);
    let y = 0;
    try {
      for (const rect of [...group].sort((a, b) => (a.boxOrder ?? Number.MAX_SAFE_INTEGER) - (b.boxOrder ?? Number.MAX_SAFE_INTEGER))) {
        const page = await document.getPage(rect.pageIndex + 1); const viewport = page.getViewport({ scale: scale * outputScale }); const source = globalThis.document.createElement('canvas'); source.width = Math.ceil(viewport.width); source.height = Math.ceil(viewport.height); const sourceContext = source.getContext('2d'); if (!sourceContext) continue; const task = page.render({ canvas: source, canvasContext: sourceContext, viewport }); this.activeRenderTask = task; await task.promise; if (sequence !== this.renderSequence) return;
        const rectWidth = rect.xMax - rect.xMin; const rectHeight = rect.yMax - rect.yMin; const x = (width - rectWidth) * scale * outputScale / 2; context.drawImage(source, rect.xMin * scale * outputScale, rect.yMin * scale * outputScale, rectWidth * scale * outputScale, rectHeight * scale * outputScale, x, y * scale * outputScale, rectWidth * scale * outputScale, rectHeight * scale * outputScale); y += rectHeight;
      }
      if (sequence !== this.renderSequence) return;
      const visibleContext = canvas.getContext('2d');
      if (!visibleContext) return;
      canvas.width = renderedWidth;
      canvas.height = renderedHeight;
      canvas.style.width = `${Math.floor(width * scale)}px`;
      canvas.style.height = `${Math.floor(height * scale)}px`;
      visibleContext.drawImage(offscreen, 0, 0);
    } catch (error) {
      if (!(error instanceof Error && error.name === 'RenderingCancelledException')) throw error;
    } finally {
      if (sequence === this.renderSequence) this.activeRenderTask = undefined;
    }
  }
}
