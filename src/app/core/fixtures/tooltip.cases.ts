import type { Edges, TooltipSide } from '../tooltip-position';

/** A 400 x 600 screen without insets, a 4 px gap, controls of 40 x 40 and a tooltip of 100 x 20. */
export const tooltipScreen: Edges = { left: 0, top: 0, right: 400, bottom: 600 };
export const TOOLTIP_GAP = 4;
export const tooltipSize = { width: 100, height: 20 };

const control = (left: number, top: number): Edges => ({ left, top, right: left + 40, bottom: top + 40 });

interface TooltipCase {
  readonly id: string;
  readonly name: string;
  readonly anchor: Edges;
  readonly side: TooltipSide;
  readonly expected: { readonly left: number; readonly top: number };
  readonly size?: { readonly width: number; readonly height: number };
  readonly area?: Edges;
}

export const tooltipCases: readonly TooltipCase[] = [
  { id: 'T01', name: 'room everywhere: centred below', anchor: control(180, 280), side: 'below', expected: { left: 150, top: 320 } },
  { id: 'T02', name: 'room everywhere: centred above', anchor: control(180, 280), side: 'above', expected: { left: 150, top: 260 } },
  { id: 'T03', name: 'left edge: pushed in', anchor: control(0, 280), side: 'below', expected: { left: 4, top: 320 } },
  { id: 'T04', name: 'right edge: pushed in', anchor: control(360, 280), side: 'below', expected: { left: 296, top: 320 } },
  { id: 'T05', name: 'top edge, below: stays below', anchor: control(180, 0), side: 'below', expected: { left: 150, top: 40 } },
  { id: 'T06', name: 'top edge, above: flips below', anchor: control(180, 0), side: 'above', expected: { left: 150, top: 40 } },
  { id: 'T07', name: 'bottom edge, below: flips above', anchor: control(180, 560), side: 'below', expected: { left: 150, top: 540 } },
  { id: 'T08', name: 'bottom edge, above: stays above', anchor: control(180, 560), side: 'above', expected: { left: 150, top: 540 } },
  { id: 'T09', name: 'top left corner', anchor: control(0, 0), side: 'above', expected: { left: 4, top: 40 } },
  { id: 'T10', name: 'top right corner', anchor: control(360, 0), side: 'above', expected: { left: 296, top: 40 } },
  { id: 'T11', name: 'bottom left corner', anchor: control(0, 560), side: 'below', expected: { left: 4, top: 540 } },
  { id: 'T12', name: 'bottom right corner', anchor: control(360, 560), side: 'below', expected: { left: 296, top: 540 } },
  { id: 'T13', name: 'below ends exactly at the gap: stays below', anchor: control(180, 536), side: 'below', expected: { left: 150, top: 576 } },
  { id: 'T14', name: 'one pixel less room: flips', anchor: control(180, 537), side: 'below', expected: { left: 150, top: 517 } },
  {
    id: 'T15',
    name: 'no room on either side: pushed inside from the preferred one',
    anchor: control(180, 280),
    side: 'below',
    size: { width: 100, height: 400 },
    expected: { left: 150, top: 196 },
  },
  {
    id: 'T16',
    name: 'larger than the screen: aligned to its left and top edge',
    anchor: control(180, 280),
    side: 'above',
    size: { width: 500, height: 700 },
    expected: { left: 4, top: 4 },
  },
  {
    id: 'T17',
    name: 'safe-area insets: stays clear of the notch and the home indicator',
    anchor: control(0, 520),
    side: 'below',
    area: { left: 30, top: 40, right: 370, bottom: 570 },
    expected: { left: 34, top: 500 },
  },
];
