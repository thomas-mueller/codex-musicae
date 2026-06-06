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

  constructor(private router: Router) {}

  @HostListener('document:keydown.escape')
  onEscape() {
    this.router.navigate(['/editor']);
  }

  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  pdfUrl = '/pdfs/test.pdf'; // später dynamisch über route param

  async ngAfterViewInit() {
    const loadingTask = pdfjsLib.getDocument({
      url: this.pdfUrl,
      cMapUrl: '/assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/assets/standard_fonts/',
      wasmUrl: '/assets/wasm/'
    });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    const canvas = this.canvasRef.nativeElement;
    const context = canvas.getContext('2d')!;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvas: canvas,
      canvasContext: context,
      viewport: viewport
    }).promise;
  }
}