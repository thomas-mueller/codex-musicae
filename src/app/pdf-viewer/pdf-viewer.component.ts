import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
} from '@angular/core';
import {
  NgxExtendedPdfViewerModule,
  NgxExtendedPdfViewerService,
} from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'pdf-viewer',
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.css'],
  standalone: true,
  imports: [NgxExtendedPdfViewerModule],
  providers: [NgxExtendedPdfViewerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfViewerComponent {
  page = 0;
  zoom = 100;

  constructor(private pdfService: NgxExtendedPdfViewerService) {  }

  onPdfLoaded(): void {
    console.log('onPdfLoaded');
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    console.log('onKeyDown', event);
    this.zoomToRect(3, 0.4, 0.4, 0.2, 0.2);
  }

  zoomToRect(
    pageNumber: number,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    this.page = pageNumber;

    const zoomFactor = Math.floor(100 / Math.max(w, h));
    console.log('zoomFactor', zoomFactor);
    this.zoom = zoomFactor;

    // this.pdfService.scrollPageIntoView(pageNumber, {
    //   left: x + w / 2,
    //   top: y + h / 2
    // });

    const viewer = document.querySelector('#viewerContainer') as HTMLElement;
    viewer?.scrollTo({
      top: 1200,
      left: 800,
      behavior: 'smooth'
    });
  }

}
