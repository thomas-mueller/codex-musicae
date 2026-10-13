export interface AnnotationPoint { x: number; y: number; }

export interface PdfAnnotationStroke {
  page: number;
  points: AnnotationPoint[];
  color: string;
  width: number;
}
