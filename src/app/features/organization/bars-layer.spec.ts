import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import type { Bar } from '../../core';
import type { ProvisionalBar } from '../../state/detection-run';
import { BarsLayer } from './bars-layer';
import type { BarRowData } from './bar-rows';
import type { JumpBadge } from './jump-badges';

const SCALE = 0.5;

function mount(inputs: {
  bars?: Bar[];
  provisionalBars?: ProvisionalBar[];
  selectedJunction?: number | null;
  rows?: Map<number, BarRowData>;
  badges?: Map<number, JumpBadge[]>;
  selectedJumpId?: number | null;
  pickingOrigin?: number | null;
}) {
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

  it('ORG-013 tapping a bar emits its junction; provisional bars emit nothing', async () => {
    const fixture = mount({
      bars: [{ junction: 3, pageIndex: 0, y: 0, height: 20 }],
      provisionalBars: [{ junction: -1, pageIndex: 1, y: 0, height: 20, provisional: true }],
    });
    const taps: number[] = [];
    fixture.componentInstance.barTap.subscribe((j) => taps.push(j));
    await fixture.whenStable();
    bars(fixture)[0]!.click();
    bars(fixture, 'org-bar-provisional')[0]!.click();
    expect(taps).toEqual([3]);
  });

  it('ORG-011 ORG-012 a bar row shows the numbers; both bars of a page change show the same text', async () => {
    const fixture = mount({
      bars: [
        { junction: 4, pageIndex: 0, y: 700, height: 100 },
        { junction: 4, pageIndex: 1, y: 0, height: 50 },
      ],
      rows: new Map([[4, { numbersText: '4, 8', hasBreak: false, hasStop: false }]]),
    });
    await fixture.whenStable();
    const texts = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="org-bar-numbers"]')).map((e) => (e as HTMLElement).textContent);
    expect(texts).toEqual(['4, 8', '4, 8']);
  });

  it('ORG-022 a break draws the line and the scissors icon; ORG-023 a stop draws the stop icon', async () => {
    const fixture = mount({
      bars: [
        { junction: 2, pageIndex: 0, y: 0, height: 20 },
        { junction: 3, pageIndex: 0, y: 50, height: 20 },
        { junction: 4, pageIndex: 0, y: 100, height: 20 },
      ],
      rows: new Map([
        [2, { numbersText: '', hasBreak: true, hasStop: false }],
        [3, { numbersText: '', hasBreak: false, hasStop: true }],
        [4, { numbersText: '', hasBreak: false, hasStop: false }],
      ]),
    });
    await fixture.whenStable();
    const [withBreak, withStop, plain] = bars(fixture);
    expect(withBreak!.querySelector('[data-testid="org-bar-break-line"]')).not.toBeNull();
    expect(withBreak!.querySelector('[data-testid="org-bar-break-icon"]')).not.toBeNull();
    expect(withBreak!.querySelector('[data-testid="org-bar-stop-icon"]')).toBeNull();
    expect(withStop!.querySelector('[data-testid="org-bar-stop-icon"]')).not.toBeNull();
    expect(withStop!.querySelector('[data-testid="org-bar-break-line"]')).toBeNull();
    expect(plain!.querySelector('[data-testid="org-bar-row"]')).toBeNull();
  });

  const badge = (over: Partial<JumpBadge>): JumpBadge => ({
    jumpId: 1, role: 'origin', otherJunction: 3, otherLabel: '7·1', pass: 2, colorIndex: 0, ...over,
  });
  const badgesOf = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('[data-testid="jump-badge"]'));

  it('ORG-018 an origin badge shows the arrow, the target label and the pass in the jump color', async () => {
    const fixture = mount({
      bars: [{ junction: 1, pageIndex: 0, y: 0, height: 20 }],
      badges: new Map([[1, [badge({ colorIndex: 2 })]]]),
    });
    await fixture.whenStable();
    const [el] = badgesOf(fixture);
    expect(el!.querySelector('app-icon')).not.toBeNull();
    expect(el!.querySelector('[data-testid="jump-badge-label"]')!.textContent).toBe('7·1');
    expect(el!.querySelector('[data-testid="jump-badge-pass"]')!.textContent).toBe(`${TUNABLES.layout.passPrefix}2`);
    expect(el!.style.background).not.toBe('');
  });

  it('ORG-018 a target badge shows the origin label and no pass; several badges stack in creation order', async () => {
    const fixture = mount({
      bars: [{ junction: 1, pageIndex: 0, y: 0, height: 20 }],
      badges: new Map([[1, [badge({ jumpId: 1, role: 'target', otherLabel: '1·5' }), badge({ jumpId: 2 })]]]),
    });
    await fixture.whenStable();
    const [first, second] = badgesOf(fixture);
    expect(first!.querySelector('[data-testid="jump-badge-pass"]')).toBeNull();
    expect(first!.querySelector('[data-testid="jump-badge-label"]')!.textContent).toBe('1·5');
    expect(second!.dataset['jumpId']).toBe('2');
  });

  it('ORG-020 tapping a badge emits its jump id and does not tap the bar', async () => {
    const fixture = mount({
      bars: [{ junction: 1, pageIndex: 0, y: 0, height: 20 }],
      badges: new Map([[1, [badge({ jumpId: 5 })]]]),
    });
    const taps: number[] = [];
    const barTaps: number[] = [];
    fixture.componentInstance.badgeTap.subscribe((id) => taps.push(id));
    fixture.componentInstance.barTap.subscribe((j) => barTaps.push(j));
    await fixture.whenStable();
    badgesOf(fixture)[0]!.click();
    expect(taps).toEqual([5]);
    expect(barTaps).toEqual([]);
  });

  it('ORG-020 the selected jump badge is marked', async () => {
    const fixture = mount({
      bars: [{ junction: 1, pageIndex: 0, y: 0, height: 20 }],
      badges: new Map([[1, [badge({ jumpId: 5 })]]]),
      selectedJumpId: 5,
    });
    await fixture.whenStable();
    expect(badgesOf(fixture)[0]!.classList.contains('selected')).toBe(true);
  });

  it('ORG-015 while picking, every bar except the origin is highlighted as a target', async () => {
    const fixture = mount({
      bars: [
        { junction: 0, pageIndex: 0, y: 0, height: 20 },
        { junction: 1, pageIndex: 0, y: 50, height: 20 },
        { junction: 2, pageIndex: 0, y: 100, height: 20 },
      ],
      pickingOrigin: 1,
    });
    await fixture.whenStable();
    expect(bars(fixture).map((b) => b.classList.contains('target'))).toEqual([true, false, true]);
    fixture.componentRef.setInput('pickingOrigin', null);
    await fixture.whenStable();
    expect(bars(fixture).some((b) => b.classList.contains('target'))).toBe(false);
  });
});
