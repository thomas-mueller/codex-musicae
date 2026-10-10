/** Central configuration for PDF/OpenCV music-system detection. */
export const PDF_DETECTION_CONFIG = {
  renderScale: 100 / 72,
  minimumBoxWidthRatio: 0.5,
  forcedSelectionWidthRatio: 0.75,
  paddingAlpha: 0.25,
  shadeAlpha: 0.25,
} as const;
