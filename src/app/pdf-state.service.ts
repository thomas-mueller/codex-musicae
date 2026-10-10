import { Injectable } from '@angular/core';
import type { BoundingBox } from './pdf-editor/bounding-boxes';

@Injectable({ providedIn: 'root' })
export class PdfStateService {
  readonly pdfUrl = '/pdfs/test.pdf';
  boxes: BoundingBox[] = [];
  padding = 0.025;
  hasEditorState = false;

  setEditorState(boxes: readonly BoundingBox[], padding: number): void {
    this.boxes = boxes.map((box) => ({ ...box }));
    this.padding = padding;
    this.hasEditorState = true;
  }
}
