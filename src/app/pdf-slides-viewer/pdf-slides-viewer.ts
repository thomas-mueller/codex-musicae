import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';

import { Router } from '@angular/router';

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

  async renderPage(pageNumber: number): Promise<void> {
    const page = await this.pdfDocument.getPage(pageNumber);

    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d')!;

    const cssViewport = page.getViewport({
      scale: this.displayScale
    });

    const renderViewport = page.getViewport({
      scale: this.displayScale * this.outputScale
    });

    canvas.width = Math.floor(renderViewport.width);
    canvas.height = Math.floor(renderViewport.height);

    canvas.style.width = `${Math.floor(cssViewport.width)}px`;
    canvas.style.height = `${Math.floor(cssViewport.height)}px`;

    await page.render({
      canvas,
      canvasContext: context,
      viewport: renderViewport
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
    // if (!this.pdfViewer || !this.pdfDocument) return;

    // const pageNumber = 3;
    // this.pdfViewer.currentPageNumber = pageNumber;
  //   const page = await this.pdfDocument.getPage(pageNumber);

  //   const [xMin, yMin, xMax, yMax] = page.view;

  //   const width = xMax - xMin;
  //   const height = yMax - yMin;

  //   const left = xMin + width * 0.20;
  //   const right = xMin + width * 0.60;

  //   const bottom = yMin + height * 0.30;
  //   const top = yMin + height * 0.50;

  //   this.pdfViewer.scrollPageIntoView({
  //     pageNumber,
  //     // destArray: [
  //     //   null,
  //     //   { name: "FitR" },
  //     //   left,
  //     //   bottom,
  //     //   right,
  //     //   top
  //     // ]
  //   });
  }
}