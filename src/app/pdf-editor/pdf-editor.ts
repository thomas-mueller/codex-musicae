import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';

import { Router } from '@angular/router';

import {
  NgxExtendedPdfViewerModule,
  NgxExtendedPdfViewerService,
} from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'app-pdf-editor',
  templateUrl: './pdf-editor.html',
  styleUrl: './pdf-editor.css',
  standalone: true,
  imports: [NgxExtendedPdfViewerModule],
  providers: [NgxExtendedPdfViewerService],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PdfEditor {


  constructor(
    private router: Router,
    private pdfService: NgxExtendedPdfViewerService
  ) {  }

  navigateToViewer = () => {
    this.router.navigate(['/viewer']);
  };

  onPdfLoaded(): void {
    console.log('onPdfLoaded');
  }
}
