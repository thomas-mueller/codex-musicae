import { Routes } from '@angular/router';
import { PdfEditor } from './pdf-editor/pdf-editor';

export const routes: Routes = [
  {
    path: 'editor',
    component: PdfEditor,
  },
  {
    path: '',
    redirectTo: 'editor',
    pathMatch: 'full',
  },
];