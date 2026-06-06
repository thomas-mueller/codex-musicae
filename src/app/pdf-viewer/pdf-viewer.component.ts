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
    // const iframe = this.pdfViewer.nativeElement.querySelector('iframe');
    // const pdfApp = iframe.contentWindow.PDFViewerApplication;
    // console.log(pdfApp);

    // const pageView = pdfApp.pdfViewer.getPageView(pageNumber);
    // const [xMin, yMin, xMax, yMax] = pageView.pdfPage.view;
    // const pageWidth = xMax - xMin;
    // const pageHeight = yMax - yMin;

    // const left   = pageWidth  * x;
    // const bottom = pageHeight * y;
    // const right  = pageWidth  * (x+w);
    // const top    = pageHeight * (y+h);

    // this.pdfService.scrollPageIntoView({
    //   pageNumber: pageNumber,
    //   destArray: [
    //     null,
    //     { name: 'FitR' },
    //     left,
    //     bottom,
    //     right,
    //     top
    //   ]
    // });
  }

}
