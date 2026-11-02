import { describe, expect, it } from 'vitest';

import { clientToSlide } from './client-to-slide';

const DIGITS = 9;
const STAGE = { x: 0, y: 0, width: 800, height: 600 };
const SLIDE = { width: 940, height: 626.667 };
const SCALE = 800 / 940;

describe('clientToSlide', () => {
  const cases = [
    { id: 'CS1', name: 'stage center is the slide center', client: { x: 400, y: 300 }, view: { zoom: 1, panX: 0, panY: 0 }, expected: { x: 470, y: 313.3335 } },
    { id: 'CS2', name: 'left edge of the stage', client: { x: 0, y: 300 }, view: { zoom: 1, panX: 0, panY: 0 }, expected: { x: 0, y: 313.3335 } },
    { id: 'CS3', name: 'zoom 2 with pan', client: { x: 400, y: 300 }, view: { zoom: 2, panX: -200, panY: 0 }, expected: { x: 587.5, y: 313.3335 } },
  ];
  for (const c of cases) {
    it(`ANN-009 ${c.id}: ${c.name}`, () => {
      const result = clientToSlide(c.client, STAGE, c.view, SCALE, SLIDE);
      expect(result.x).toBeCloseTo(c.expected.x, DIGITS);
      expect(result.y).toBeCloseTo(c.expected.y, DIGITS);
    });
  }

  it('ANN-009 a stage that does not start at the origin is measured from its own center', () => {
    const result = clientToSlide({ x: 500, y: 350 }, { x: 100, y: 50, width: 800, height: 600 }, { zoom: 1, panX: 0, panY: 0 }, SCALE, SLIDE);
    expect(result.x).toBeCloseTo(470, DIGITS);
    expect(result.y).toBeCloseTo(313.3335, DIGITS);
  });
});
