import { Routes } from '@angular/router';
import { PdfEditor } from './features/pdf-editor/pdf-editor';
import { PdfSlidesViewer } from './features/pdf-slides-viewer/pdf-slides-viewer';

export const routes: Routes = [
  {
    path: 'editor',
    component: PdfEditor,
  },
  {
    path: 'viewer',
    component: PdfSlidesViewer,
  },
  {
    path: '',
    redirectTo: 'editor',
    pathMatch: 'full',
  },
];
