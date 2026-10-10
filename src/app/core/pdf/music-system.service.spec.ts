import { describe, expect, it } from 'vitest';
import { PDF_DETECTION_CONFIG } from './pdf-detection.config';
import { shouldSelectConnectedComponent } from './music-system.service';

describe('connected-component selection', () => {
  const canvasWidth = 1000;
  const threshold = 500;

  it('rejects boxes below the configured minimum width', () => {
    expect(shouldSelectConnectedComponent(1000, canvasWidth * 0.49, canvasWidth, threshold)).toBe(false);
  });

  it('requires the area threshold for boxes between the width limits', () => {
    expect(shouldSelectConnectedComponent(500, canvasWidth * 0.6, canvasWidth, threshold)).toBe(false);
    expect(shouldSelectConnectedComponent(501, canvasWidth * 0.6, canvasWidth, threshold)).toBe(true);
  });

  it('always selects boxes at the forced width', () => {
    expect(shouldSelectConnectedComponent(1, canvasWidth * PDF_DETECTION_CONFIG.forcedSelectionWidthRatio, canvasWidth, threshold)).toBe(true);
  });
});
