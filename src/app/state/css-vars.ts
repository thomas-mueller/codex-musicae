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
    '--cm-indicator-placeholder': JSON.stringify(t.layout.indicatorPlaceholder),
    '--cm-icon-size': `${t.layout.iconSizePx}px`,
    '--cm-tooltip-padding': `${t.layout.tooltipPaddingPx}px`,
    '--cm-tooltip-radius': `${t.layout.tooltipRadiusPx}px`,
    '--cm-popup-duration': `${t.layout.popupAnimationMs}ms`,
    '--cm-popup-radius': `${t.layout.popupRadiusPx}px`,
    '--cm-fab-inset': `${t.layout.fabInsetPx}px`,
    '--cm-touch-target': `${t.layout.minTouchTargetPx}px`,
    '--cm-tab-gap': `${t.layout.tabGapPx}px`,
    '--cm-disabled-opacity': String(t.layout.disabledOpacity),
  };
}
