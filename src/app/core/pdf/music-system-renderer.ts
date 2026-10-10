import type { MusicSystem } from './music-system.model';

export function drawMusicSystems(
  context: CanvasRenderingContext2D,
  pageNumber: number,
  musicSystems: readonly MusicSystem[],
  canvasWidth: number,
  canvasHeight: number,
  padding = 0,
): void {
  context.save();
  const originalLineWidth = Math.max(1, Math.min(canvasWidth, canvasHeight) * 0.0025);
  const yPadding = padding * (canvasWidth / canvasHeight);

  for (const musicSystem of musicSystems) {
    if (musicSystem.page !== pageNumber) continue;
    const x = musicSystem.xMin * canvasWidth;
    const y = musicSystem.yMin * canvasHeight;
    const width = (musicSystem.xMax - musicSystem.xMin) * canvasWidth;
    const height = (musicSystem.yMax - musicSystem.yMin) * canvasHeight;

    if (padding > 0) {
      const paddedX = Math.max(0, x - padding * canvasWidth);
      const paddedY = Math.max(0, y - yPadding * canvasHeight);
      const paddedRight = Math.min(canvasWidth, x + width + padding * canvasWidth);
      const paddedBottom = Math.min(canvasHeight, y + height + yPadding * canvasHeight);
      context.fillStyle = 'rgb(229 57 53 / 25%)';
      context.fillRect(paddedX, paddedY, paddedRight - paddedX, y - paddedY);
      context.fillRect(paddedX, y + height, paddedRight - paddedX, paddedBottom - (y + height));
      context.fillRect(paddedX, y, x - paddedX, height);
      context.fillRect(x + width, y, paddedRight - (x + width), height);
    }

    context.strokeStyle = '#e53935';
    context.lineWidth = originalLineWidth;
    context.strokeRect(x, y, width, height);
  }
  context.restore();
}
