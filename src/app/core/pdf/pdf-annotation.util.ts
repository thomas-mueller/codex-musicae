import type { PdfAnnotationStroke, AnnotationPoint } from './pdf-annotations.model';

export function drawAnnotations(
  context: CanvasRenderingContext2D,
  strokes: readonly PdfAnnotationStroke[],
  page: number,
  width: number,
  height: number,
  scale = 1,
): void {
  context.save();
  for (const stroke of strokes) {
    if (stroke.page !== page || stroke.points.length < 2) continue;
    context.beginPath();
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width * scale;
    context.lineCap = 'round'; context.lineJoin = 'round';
    stroke.points.forEach((point, index) => {
      const x = point.x * width; const y = point.y * height;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.stroke();
  }
  context.restore();
}

export function normalizePoint(x: number, y: number, width: number, height: number): AnnotationPoint {
  return { x: Math.max(0, Math.min(1, x / width)), y: Math.max(0, Math.min(1, y / height)) };
}
