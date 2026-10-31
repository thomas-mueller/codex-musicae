import { TUNABLES } from '../../config/tunables';
import { tunablesToCssVars } from './css-vars';

describe('tunablesToCssVars', () => {
  it('GEN-008 maps the canvas grey', () => {
    expect(tunablesToCssVars(TUNABLES)['--cm-canvas-grey']).toBe(TUNABLES.colors.canvasGrey);
  });

  it('UIX-007 maps bar height and touch target in px', () => {
    const vars = tunablesToCssVars(TUNABLES);
    expect(vars['--cm-bar-height']).toBe(`${TUNABLES.layout.barHeightPx}px`);
    expect(vars['--cm-touch-target']).toBe(`${TUNABLES.layout.minTouchTargetPx}px`);
  });
});
