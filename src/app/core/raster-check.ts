/** What a working raster read back as: usable, a canvas the browser lost, or a single flat colour (NFR-028). */
export type RasterVerdict = 'ok' | 'lost' | 'flat';

interface RasterCheckLimits {
  /** Alpha (0..255) below which a sample counts as transparent: pdf.js fills every rendered canvas opaque. */
  readonly minAlpha: number;
  /** Largest difference per channel that still counts as one flat colour. */
  readonly flatTolerance: number;
}

const CHANNELS = 4; // RGBA
const ALPHA = 3;

/**
 * NFR-028: classifies the RGBA samples of a small copy of a rendered page.
 * - `lost`: any sample is transparent. pdf.js paints an opaque background before it draws, so a page that was rendered, even a
 *   completely white one, is opaque everywhere; transparency means the browser dropped the canvas (memory pressure).
 * - `flat`: opaque but one colour. A white page looks like this, and so does a page whose image was not drawn: never an error by itself.
 * - `ok`: anything else, and no samples at all (nothing to judge).
 */
export function classifyRaster(samples: ArrayLike<number>, limits: RasterCheckLimits): RasterVerdict {
  const pixels = Math.floor(samples.length / CHANNELS);
  if (pixels === 0) {
    return 'ok';
  }
  const sample = (index: number): number => samples[index] ?? 0;
  const first = [sample(0), sample(1), sample(2)];
  const min = [...first];
  const max = [...first];
  for (let pixel = 0; pixel < pixels; pixel++) {
    const base = pixel * CHANNELS;
    if (sample(base + ALPHA) < limits.minAlpha) {
      return 'lost';
    }
    for (let channel = 0; channel < ALPHA; channel++) {
      const value = sample(base + channel);
      min[channel] = Math.min(min[channel] ?? value, value);
      max[channel] = Math.max(max[channel] ?? value, value);
    }
  }
  const flat = [0, 1, 2].every((channel) => (max[channel] ?? 0) - (min[channel] ?? 0) <= limits.flatTolerance);
  return flat ? 'flat' : 'ok';
}
