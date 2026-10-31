import { TUNABLES } from '../../../config/tunables';
import type { Bar, DocMarks } from '../../core';
import { formatLabel, jumpBadges } from './jump-badges';

/** Same two-page bars as the junction-label fixture: junction 2 sits on the page change (two bars). */
const bars: Bar[] = [
  { junction: 0, pageIndex: 0, y: 0, height: 100 },
  { junction: 1, pageIndex: 0, y: 300, height: 100 },
  { junction: 2, pageIndex: 0, y: 580, height: 820 },
  { junction: 2, pageIndex: 1, y: 0, height: 80 },
  { junction: 3, pageIndex: 1, y: 300, height: 1100 },
];
const palette = TUNABLES.colors.jumpPalette.length;
const marks = (jumps: DocMarks['jumps']): DocMarks => ({ jumps, breaks: [], stops: [], nextJumpId: jumps.length + 1 });

describe('jumpBadges', () => {
  it('ORG-018 formats a label as page and bar number joined by the separator', () => {
    expect(formatLabel({ page: 7, ordinal: 1 })).toBe(`7${TUNABLES.layout.labelSeparator}1`);
  });

  it('ORG-018 the origin badge shows the target label and the pass, the target badge the origin label', () => {
    const result = jumpBadges(marks([{ origin: 1, target: 3, pass: 2, id: 1 }]), bars, palette);
    expect(result.get(1)).toEqual([
      { jumpId: 1, role: 'origin', otherJunction: 3, otherLabel: formatLabel({ page: 2, ordinal: 2 }), pass: 2, colorIndex: 0 },
    ]);
    expect(result.get(3)).toEqual([
      { jumpId: 1, role: 'target', otherJunction: 1, otherLabel: formatLabel({ page: 1, ordinal: 2 }), pass: 2, colorIndex: 0 },
    ]);
  });

  it('ORG-018 both ends share one color that cycles with the jump id', () => {
    const jumps = Array.from({ length: palette + 1 }, (_, i) => ({ origin: 0, target: 1, pass: 1, id: i + 1 }));
    const result = jumpBadges(marks(jumps), bars, palette).get(0) ?? [];
    expect(result.map((b) => b.colorIndex)).toEqual([...Array(palette).keys(), 0]);
  });

  it('ORG-018 several badges on one junction keep creation order', () => {
    const result = jumpBadges(
      marks([{ origin: 0, target: 1, pass: 1, id: 1 }, { origin: 3, target: 0, pass: 1, id: 2 }]),
      bars,
      palette,
    );
    expect(result.get(0)?.map((b) => [b.jumpId, b.role])).toEqual([[1, 'origin'], [2, 'target']]);
  });

  it('ORG-018 an end without bars (outside the usable prefix) gets no badge', () => {
    const result = jumpBadges(marks([{ origin: 1, target: 9, pass: 1, id: 1 }]), bars, palette);
    expect(result.get(1)).toBeUndefined();
    expect(result.get(9)?.[0]?.role).toBe('target');
  });
});
