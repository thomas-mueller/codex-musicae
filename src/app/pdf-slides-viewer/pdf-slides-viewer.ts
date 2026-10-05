import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';

import { Router } from '@angular/router';

// https://mozilla.github.io/pdf.js/api/
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-slides-viewer',
  templateUrl: './pdf-slides-viewer.html',
  styleUrl: './pdf-slides-viewer.css',
  standalone: true,
})
export class PdfSlidesViewer implements AfterViewInit {

  @ViewChild('pdfContainer')
  pdfContainerRef!: ElementRef<HTMLDivElement>;

  @ViewChild('pdfCanvas')
  canvasRef!: ElementRef<HTMLCanvasElement>;

  pdfUrl = '/pdfs/test.pdf'; // später dynamisch über route param
  private pdfDocument!: pdfjsLib.PDFDocumentProxy;

  private basePageWidth = 0;
  private basePageHeight = 0;

  private displayScale = 1;
  private outputScale = 1;

  constructor(private router: Router) {}

  async ngAfterViewInit() {
    const loadingTask = pdfjsLib.getDocument({
      url: this.pdfUrl,
      cMapUrl: '/assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/assets/standard_fonts/',
      wasmUrl: '/assets/wasm/'
    });
    this.pdfDocument = await loadingTask.promise;

    const firstPage = await this.pdfDocument.getPage(1);
    const baseViewport = firstPage.getViewport({ scale: 1 });
    this.basePageWidth = baseViewport.width;
    this.basePageHeight = baseViewport.height;
    this.updateScaleForContainer();

    const pageNumber = 1;
    await this.renderPage(pageNumber);
  }

  private updateScaleForContainer(): void {
    const container = this.pdfContainerRef.nativeElement;
    const availableWidth = container.clientWidth;
    const availableHeight = container.clientHeight;
    const horizontalPadding = 0;
    const verticalPadding = 0;

    const horizontalDisplayScale = (availableWidth - horizontalPadding) / this.basePageWidth;
    const verticalDisplayScale = (availableHeight - verticalPadding) / this.basePageHeight;
    this.displayScale = Math.min(horizontalDisplayScale, verticalDisplayScale);
    // this.displayScale = Math.max(0.25, Math.min(this.displayScale, 4));
    this.outputScale = window.devicePixelRatio || 1;
  }

  async renderPage(
    pageNumber: number,
    cropRect?: [number, number, number, number] // [x0, y0, x1, y1] in 0..1
  ): Promise<void> {
    const page = await this.pdfDocument.getPage(pageNumber);

    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d')!;

    const viewport = page.getViewport({
      scale: this.displayScale * this.outputScale
    });
    console.log('viewport', viewport);

    let offsetX = 0;
    let offsetY = 0;
    let renderWidth = viewport.width;
    let renderHeight = viewport.height;

    if (cropRect) {
      const [x0, y0, x1, y1] = cropRect;

      const cropW = x1 - x0;
      const cropH = y1 - y0;

      const cropScale = 1 / Math.max(cropW, cropW);
      console.log('cropScale', cropScale);

      renderWidth = viewport.width * cropW;
      renderHeight = viewport.height * cropH;

      offsetX = -x0 * viewport.width;
      offsetY = -y0 * viewport.height;
    }

    canvas.width = Math.floor(renderWidth);
    canvas.height = Math.floor(renderHeight);

    canvas.style.width = `${Math.floor(renderWidth / this.outputScale)}px`;
    canvas.style.height = `${Math.floor(renderHeight / this.outputScale)}px`;

    console.log('canvas', canvas);
    console.log('context', context);
    console.log('viewport', viewport);
    console.log('offsetX', offsetX);
    console.log('offsetY', offsetY);
    await page.render({
      canvas: canvas,
      viewport: viewport,
      canvasContext: context,
      transform: [1, 0, 0, 1, offsetX, offsetY]
    }).promise;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.router.navigate(['/editor']);
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    console.log('onKeyDown', event);
    this.test();
  }

  async test(): Promise<void> {
    this.renderPage(1, [0.25, 0.25, 0.75, 0.75]);
  }
}