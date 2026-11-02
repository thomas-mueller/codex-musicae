import { presentationProgress } from './progress';

describe('presentationProgress', () => {
  it('UIX-020 is index over n-1', () => {
    expect(presentationProgress(0, 5)).toBe(0);
    expect(presentationProgress(1, 5)).toBe(0.25);
    expect(presentationProgress(4, 5)).toBe(1);
  });

  it('UIX-020 one slide is full, no slides hides the line', () => {
    expect(presentationProgress(0, 1)).toBe(1);
    expect(presentationProgress(0, 0)).toBeNull();
  });
});
