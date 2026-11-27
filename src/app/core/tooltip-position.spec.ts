import { describe, expect, it } from 'vitest';

import { TOOLTIP_GAP, tooltipCases, tooltipScreen, tooltipSize } from './fixtures/tooltip.cases';
import { placeTooltip } from './tooltip-position';

describe('placeTooltip', () => {
  for (const c of tooltipCases) {
    it(`UIX-027 ${c.id}: ${c.name}`, () => {
      expect(placeTooltip(c.anchor, c.size ?? tooltipSize, c.area ?? tooltipScreen, c.side, TOOLTIP_GAP)).toEqual(c.expected);
    });
  }
});
