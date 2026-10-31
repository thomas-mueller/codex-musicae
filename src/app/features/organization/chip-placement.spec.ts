import { chipPlacement } from './chip-placement';

const GAP = 8;
const CHIP = { width: 200, height: 56 };
const VIEW = { x: 0, y: 1000, width: 400, height: 600 };

describe('chipPlacement', () => {
  it('ORG-014 sits below the bar, right-aligned', () => {
    const bar = { x: 0, y: 1100, width: 400, height: 20 };
    expect(chipPlacement(bar, CHIP, VIEW, GAP)).toEqual({ x: 400 - CHIP.width - GAP, y: 1100 + 20 + GAP });
  });

  it('ORG-014 flips above the bar when below would leave the viewport', () => {
    const bar = { x: 0, y: 1560, width: 400, height: 20 };
    expect(chipPlacement(bar, CHIP, VIEW, GAP).y).toBe(1560 - GAP - CHIP.height);
  });

  it('ORG-014 stays inside the viewport when neither side fits', () => {
    const bar = { x: 0, y: 1000, width: 400, height: 600 };
    const { y } = chipPlacement(bar, CHIP, VIEW, GAP);
    expect(y).toBeGreaterThanOrEqual(VIEW.y);
    expect(y + CHIP.height).toBeLessThanOrEqual(VIEW.y + VIEW.height);
  });

  it('ORG-014 is clamped horizontally into the viewport', () => {
    const wide = { x: 0, y: 1100, width: 2000, height: 20 };
    expect(chipPlacement(wide, CHIP, VIEW, GAP).x).toBe(VIEW.width - CHIP.width);
    const left = { x: -500, y: 1100, width: 300, height: 20 };
    expect(chipPlacement(left, CHIP, VIEW, GAP).x).toBe(VIEW.x);
  });
});
