import {
  Component,
  AfterViewInit,
  ElementRef,
  ViewChild,
  HostListener,
} from '@angular/core';

import { Router } from '@angular/router';

import * as pdfjsLib from 'pdfjs-dist';
import {
  EventBus,
  PDFLinkService,
  PDFViewer
} from 'pdfjs-dist/web/pdf_viewer.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  '/assets/pdfjs-dist/build/pdf.worker.min.mjs';

@Component({
  selector: 'app-pdf-slides-viewer',
  templateUrl: './pdf-slides-viewer.html',
  styleUrl: './pdf-slides-viewer.css',
  standalone: true,
})
export class PdfSlidesViewer implements AfterViewInit {

  private pdfDocument!: pdfjsLib.PDFDocumentProxy;
  private pdfViewer!: PDFViewer;
  private linkService!: PDFLinkService;
  private eventBus!: EventBus;

  constructor(private router: Router) {}

  @HostListener('document:keydown.escape')
  onEscape() {
    this.router.navigate(['/editor']);
  }

  // @ViewChild('canvas', { static: true })
  // canvasRef!: ElementRef<HTMLCanvasElement>;

  @ViewChild('viewerContainer', { static: false })
  viewerContainer!: ElementRef<HTMLDivElement>;

  pdfUrl = '/pdfs/test.pdf'; // später dynamisch über route param

  async ngAfterViewInit() {
    this.eventBus = new EventBus();

    this.linkService = new PDFLinkService({
      eventBus: this.eventBus
    });

    this.pdfViewer = new PDFViewer({
      container: this.viewerContainer.nativeElement,
      eventBus: this.eventBus,
      linkService: this.linkService
    });
    this.pdfViewer.currentScaleValue = 'page-width';
    this.linkService.setViewer(this.pdfViewer);

    const loadingTask = pdfjsLib.getDocument({
      url: this.pdfUrl,
      cMapUrl: '/assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/assets/standard_fonts/',
      wasmUrl: '/assets/wasm/'
    });
    this.pdfDocument = await loadingTask.promise;

    this.pdfViewer.setDocument(this.pdfDocument);
    this.linkService.setDocument(this.pdfDocument);
  }
}