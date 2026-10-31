import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import type { Bar } from '../../core';
import type { ProvisionalBar } from '../../state/detection-run';
import { BarsLayer } from './bars-layer';

const SCALE = 0.5;

function mount(inputs: { bars?: Bar[]; provisionalBars?: ProvisionalBar[]; selectedJunction?: number | null }) {
  const fixture = TestBed.createComponent(BarsLayer);
  fixture.componentRef.setInput('scale', SCALE);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  return fixture;
}

const bars = (fixture: { nativeElement: HTMLElement }, testId = 'org-bar') =>
  Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));

describe('BarsLayer', () => {
  it('ORG-008 places a bar at y × scale with height × scale', async () => {
    const fixture = mount({ bars: [{ junction: 1, pageIndex: 0, y: 200, height: 60 }] });
    await fixture.whenStable();
    const [bar] = bars(fixture);
    expect(parseFloat(bar!.style.top)).toBeCloseTo(200 * SCALE);
    expect(parseFloat(bar!.style.height)).toBeCloseTo(60 * SCALE);
  });

  it('ORG-008 draws a zero-height bar as a line of orgBar.minHeightPx', async () => {
    const fixture = mount({ bars: [{ junction: 0, pageIndex: 0, y: 0, height: 0 }] });
    await fixture.whenStable();
    expect(parseFloat(bars(fixture)[0]!.style.height)).toBe(TUNABLES.colors.orgBar.minHeightPx);
  });

  it('ORG-009 a page without bars draws nothing', async () => {
    const fixture = mount({});
    await fixture.whenStable();
    expect(bars(fixture)).toHaveLength(0);
    expect(bars(fixture, 'org-bar-provisional')).toHaveLength(0);
  });

  it('ORG-010 highlights every bar of the selected junction and no other', async () => {
    const fixture = mount({
      bars: [
        { junction: 4, pageIndex: 1, y: 700, height: 100 },
        { junction: 5, pageIndex: 1, y: 100, height: 50 },
      ],
      selectedJunction: 4,
    });
    await fixture.whenStable();
    expect(bars(fixture).map((b) => b.classList.contains('selected'))).toEqual([true, false]);
    fixture.componentRef.setInput('selectedJunction', null);
    await fixture.whenStable();
    expect(bars(fixture).some((b) => b.classList.contains('selected'))).toBe(false);
  });

  it('DET-021 provisional bars are dimmed, inert and empty', async () => {
    const fixture = mount({ provisionalBars: [{ junction: -1, pageIndex: 2, y: 10, height: 20, provisional: true }] });
    await fixture.whenStable();
    const [bar] = bars(fixture, 'org-bar-provisional');
    expect(bar!.classList.contains('provisional')).toBe(true);
    expect(bar!.childElementCount).toBe(0);
    expect(bar!.textContent).toBe('');
    expect(bars(fixture)).toHaveLength(0);
  });
});
