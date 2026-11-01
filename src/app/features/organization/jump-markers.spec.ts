import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { EMPTY_MARKS, markPositions } from '../../core';
import type { Bar, DocMarks, SystemInfo } from '../../core';
import { JumpMarkers, jumpMarkers } from './jump-markers';
import type { JumpMarker } from './jump-markers';

const palette = TUNABLES.colors.jumpPalette.length;
/** Two pages with two systems each: junctions 0..4, junction 2 sits on the page change. */
const systems: SystemInfo[] = [
  { index: 1, pageIndex: 0, box: { x: 0, y: 100, width: 500, height: 100 } },
  { index: 2, pageIndex: 0, box: { x: 0, y: 500, width: 500, height: 100 } },
  { index: 3, pageIndex: 1, box: { x: 0, y: 100, width: 500, height: 100 } },
  { index: 4, pageIndex: 1, box: { x: 0, y: 500, width: 500, height: 100 } },
];
const bars: Bar[] = [
  { junction: 0, pageIndex: 0, y: 0, height: 100 },
  { junction: 1, pageIndex: 0, y: 200, height: 300 },
  { junction: 2, pageIndex: 0, y: 600, height: 200 },
  { junction: 2, pageIndex: 1, y: 0, height: 100 },
  { junction: 3, pageIndex: 1, y: 200, height: 300 },
  { junction: 4, pageIndex: 1, y: 600, height: 200 },
];
const marks = (jumps: DocMarks['jumps']): DocMarks => ({ ...EMPTY_MARKS, jumps, nextJumpId: jumps.length + 1 });
const markersOf = (m: DocMarks) => jumpMarkers(m, systems, bars, palette, markPositions(m, systems.length, TUNABLES.playingOrder.maxLength));

describe('jumpMarkers', () => {
  it('ORG-018 the start is on the source system, the end on the system after the target junction', () => {
    const [start, end] = markersOf(marks([{ origin: 4, target: 1, pass: 1, id: 1 }]));
    expect(start).toMatchObject({ role: 'origin', pageIndex: 1, y: 500, height: 100, otherJunction: 1, pass: 1 });
    expect(end).toMatchObject({ role: 'target', pageIndex: 0, y: 500, height: 100, otherJunction: 4, pass: 1 });
  });

  it('ORG-018 both ends carry the playing-order numbers of the systems before and after the jump, never print numbers', () => {
    // 1 2 3 4 | jump 4 -> 1 | 2 3 4: the jump sits between the 4th played system and the 5th.
    const [start, end] = markersOf(marks([{ origin: 4, target: 1, pass: 1, id: 1 }]));
    expect([start, end].map((m) => [m!.previous, m!.next])).toEqual([[4, 5], [4, 5]]);
  });

  it('ORG-018 a jump that is never reached has no numbers', () => {
    const [start] = markersOf(marks([{ origin: 4, target: 1, pass: 2, id: 1 }]));
    expect([start!.previous, start!.next]).toEqual([null, null]);
  });

  it('ORG-018 both ends of a jump share the color, which cycles with the jump id', () => {
    const jumps = Array.from({ length: palette + 1 }, (_, i) => ({ origin: 2, target: 0, pass: i + 1, id: i + 1 }));
    const result = markersOf(marks(jumps)).filter((m) => m.role === 'origin');
    expect(result.map((m) => m.colorIndex)).toEqual([...Array(palette).keys(), 0]);
  });

  it('ORG-018 a start at junction 0 has no source system and falls back to bar 0', () => {
    const [start, end] = markersOf(marks([{ origin: 0, target: 2, pass: 1, id: 1 }]));
    expect(start).toMatchObject({ role: 'origin', pageIndex: 0, y: 0, height: 100, previous: null, next: 1 });
    expect(end).toMatchObject({ role: 'target', pageIndex: 1, y: 100 });
  });

  it('ORG-018 an end at junction N has no next system: bar N, and no next number', () => {
    const [start, end] = markersOf(marks([{ origin: 1, target: 4, pass: 1, id: 1 }]));
    expect(start).toMatchObject({ role: 'origin', previous: 1, next: null });
    expect(end).toMatchObject({ role: 'target', pageIndex: 1, y: 600, height: 200 });
  });

  it('ORG-018 an end beyond the usable prefix gets no marker; the start keeps its place', () => {
    const result = markersOf(marks([{ origin: 1, target: 9, pass: 1, id: 1 }]));
    expect(result.map((m) => m.role)).toEqual(['origin']);
  });

  it('ORG-018 markers follow the creation order of the jumps', () => {
    const result = markersOf(marks([{ origin: 1, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }]));
    expect(result.filter((m) => m.role === 'origin').map((m) => m.jumpId)).toEqual([1, 2]);
  });
});

describe('JumpMarkers', () => {
  const marker = (over: Partial<JumpMarker>): JumpMarker => ({
    jumpId: 1, role: 'origin', pageIndex: 0, y: 100, height: 100, previous: 4, next: 5, otherJunction: 2, pass: 2, colorIndex: 0, ...over,
  });

  function mount(markers: JumpMarker[], selectedJumpId: number | null = null) {
    const fixture = TestBed.createComponent(JumpMarkers);
    fixture.componentRef.setInput('markers', markers);
    fixture.componentRef.setInput('scale', 0.5);
    fixture.componentRef.setInput('selectedJumpId', selectedJumpId);
    return fixture;
  }
  const markersOf = (fixture: { nativeElement: HTMLElement }) =>
    Array.from(fixture.nativeElement.querySelectorAll<HTMLElement>('[data-testid="jump-marker"]'));

  it('ORG-018 a start shows the split icon and "<previous> → <next> ×<pass>" in the jump color', async () => {
    const fixture = mount([marker({ colorIndex: 2 })]);
    await fixture.whenStable();
    const [el] = markersOf(fixture);
    expect(el!.querySelector('app-icon use')!.getAttribute('href')).toContain(TUNABLES.icons.jump);
    expect(el!.querySelector('[data-testid="jump-marker-label"]')!.textContent).toBe(`4 ${TUNABLES.layout.listArrow} 5 ${TUNABLES.layout.passPrefix}2`);
    expect(el!.style.background).not.toBe('');
    expect(el!.closest('.group')!.classList.contains('start')).toBe(true);
  });

  it('ORG-018 an end shows the merge icon on the left and the same label', async () => {
    const fixture = mount([marker({ role: 'target' })]);
    await fixture.whenStable();
    const [el] = markersOf(fixture);
    expect(el!.querySelector('app-icon use')!.getAttribute('href')).toContain(TUNABLES.icons.jumpEnd);
    expect(el!.querySelector('[data-testid="jump-marker-label"]')!.textContent).toBe(`4 ${TUNABLES.layout.listArrow} 5 ${TUNABLES.layout.passPrefix}2`);
    expect(el!.closest('.group')!.classList.contains('end')).toBe(true);
  });

  it('ORG-018 a missing number shows the placeholder', async () => {
    const fixture = mount([marker({ previous: null, next: null })]);
    await fixture.whenStable();
    const unknown = TUNABLES.layout.unknownNumber;
    expect(markersOf(fixture)[0]!.querySelector('[data-testid="jump-marker-label"]')!.textContent).toBe(`${unknown} ${TUNABLES.layout.listArrow} ${unknown} ${TUNABLES.layout.passPrefix}2`);
  });

  it('ORG-018 several markers on one system stack in one group, in order; the group is centered on the system', async () => {
    const fixture = mount([marker({ jumpId: 1 }), marker({ jumpId: 2 }), marker({ jumpId: 3, y: 500 })]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const groups = Array.from(root.querySelectorAll<HTMLElement>('.group'));
    expect(groups).toHaveLength(2);
    expect(Array.from(groups[0]!.querySelectorAll<HTMLElement>('[data-testid="jump-marker"]')).map((e) => e.dataset['jumpId'])).toEqual(['1', '2']);
    expect(parseFloat(groups[0]!.style.top)).toBeCloseTo(100 * 0.5);
    expect(parseFloat(groups[0]!.style.height)).toBeCloseTo(100 * 0.5);
  });

  it('ORG-020 tapping a marker emits its jump id; the selected jump is marked', async () => {
    const fixture = mount([marker({ jumpId: 5 })], 5);
    const taps: number[] = [];
    fixture.componentInstance.markerTap.subscribe((id) => taps.push(id));
    await fixture.whenStable();
    markersOf(fixture)[0]!.click();
    expect(taps).toEqual([5]);
    expect(markersOf(fixture)[0]!.classList.contains('selected')).toBe(true);
  });
});
