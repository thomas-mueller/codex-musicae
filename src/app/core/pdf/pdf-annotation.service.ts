import { Injectable, signal } from '@angular/core';
import type { PdfAnnotationStroke } from './pdf-annotations.model';

@Injectable({ providedIn: 'root' })
export class PdfAnnotationService {
  readonly strokes = signal<PdfAnnotationStroke[]>([]);
  readonly dirty = signal(false);

  add(stroke: PdfAnnotationStroke): void {
    if (stroke.points.length > 1) {
      this.strokes.update((items) => [...items, stroke]);
      this.dirty.set(true);
    }
  }

  clear(): void { this.strokes.set([]); this.dirty.set(false); }
  markSaved(): void { this.clear(); }
}
