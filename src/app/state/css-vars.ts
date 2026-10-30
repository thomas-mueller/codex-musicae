import type { TUNABLES } from '../../config/tunables';

type Tunables = typeof TUNABLES;

/** Maps tunables to CSS custom properties; components only use var(--cm-…). GEN-008, UIX-007 */
export function tunablesToCssVars(t: Tunables): Readonly<Record<string, string>> {
  return {
    '--cm-canvas-grey': t.colors.canvasGrey,
    '--cm-paper': t.colors.paper,
    '--cm-accent': t.colors.accent,
    '--cm-on-accent': t.colors.onAccent,
    '--cm-icon': t.colors.iconDefault,
    '--cm-bar-bg': t.colors.barBackground,
    '--cm-bar-height': `${t.layout.barHeightPx}px`,
    '--cm-touch-target': `${t.layout.minTouchTargetPx}px`,
    '--cm-disabled-opacity': String(t.layout.disabledOpacity),
  };
}
