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

  it('ORG-010 maps the bar tint and its opacities', () => {
    const vars = tunablesToCssVars(TUNABLES);
    expect(vars['--cm-org-bar-tint']).toBe(TUNABLES.colors.orgBar.tint);
    expect(vars['--cm-org-bar-opacity']).toBe(String(TUNABLES.colors.orgBar.opacity));
    expect(vars['--cm-org-bar-selected-opacity']).toBe(String(TUNABLES.colors.orgBar.selectedOpacity));
    expect(vars['--cm-org-bar-provisional-opacity']).toBe(String(TUNABLES.colors.orgBar.provisionalOpacity));
  });
});
