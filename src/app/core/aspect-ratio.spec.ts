import { describe, expect, it } from 'vitest';

import { initialAspectRatio, orientationOf, stepAspectRatio } from './aspect-ratio';
import {
  aspectLimits, initialAspectRatioCases, initialRatioConfig, orientationCases, stepAspectRatioCases,
} from './fixtures/aspect-ratio.cases';

describe('stepAspectRatio', () => {
  for (const c of stepAspectRatioCases) {
    it(`${c.req} ${c.id}: ${c.current} ${c.direction} -> ${c.expected}`, () => {
      expect(stepAspectRatio(c.current, c.direction, aspectLimits)).toBe(c.expected);
    });
  }

  it('SLD-013 repeated "more" from 1.78 ends at exactly 0.5 and never leaves [0.5, 2.0]', () => {
    const maxSteps = 50;
    let value = 1.78;
    for (let i = 0; i < maxSteps; i++) {
      value = stepAspectRatio(value, 'more', aspectLimits);
      expect(value).toBeGreaterThanOrEqual(aspectLimits.min);
      expect(value).toBeLessThanOrEqual(aspectLimits.max);
    }
    expect(value).toBe(0.5);
  });
});

describe('initialAspectRatio', () => {
  for (const c of initialAspectRatioCases) {
    it(`${c.req} ${c.id}: ${c.width}x${c.height} -> ${c.expected}`, () => {
      expect(initialAspectRatio(c.width, c.height, initialRatioConfig)).toBe(c.expected);
    });
  }
});

describe('orientationOf', () => {
  for (const c of orientationCases) {
    it(`${c.req} ${c.id}: ${c.width}x${c.height} is ${c.expected}`, () => {
      expect(orientationOf(c.width, c.height)).toBe(c.expected);
    });
  }
});
