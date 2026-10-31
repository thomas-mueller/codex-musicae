import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { EMPTY_MARKS } from '../../core';
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

describe('jumpMarkers', () => {
  it('ORG-018 the start is on the source system and shows the target system number, the end is on the system after the target junction and shows the source system number', () => {
    const [start, end] = jumpMarkers(marks([{ origin: 4, target: 1, pass: 2, id: 1 }]), systems, bars, palette);
    expect(start).toMatchObject({ role: 'origin', pageIndex: 1, y: 500, height: 100, otherNumber: 2, otherJunction: 1, pass: 2 });
    expect(end).toMatchObject({ role: 'target', pageIndex: 0, y: 500, height: 100, otherNumber: 4, otherJunction: 4, pass: 2 });
  });

  it('ORG-018 both ends of a jump share the color, which cycles with the jump id', () => {
    const jumps = Array.from({ length: palette + 1 }, (_, i) => ({ origin: 2, target: 0, pass: i + 1, id: i + 1 }));
    const result = jumpMarkers(marks(jumps), systems, bars, palette).filter((m) => m.role === 'origin');
    expect(result.map((m) => m.colorIndex)).toEqual([...Array(palette).keys(), 0]);
  });

  it('ORG-018 a start at junction 0 has no source system and falls back to bar 0', () => {
    const [start, end] = jumpMarkers(marks([{ origin: 0, target: 2, pass: 1, id: 1 }]), systems, bars, palette);
    expect(start).toMatchObject({ role: 'origin', pageIndex: 0, y: 0, height: 100, otherNumber: 3 });
    expect(end).toMatchObject({ role: 'target', pageIndex: 1, y: 100, otherNumber: null });
  });

  it('ORG-018 an end at junction N has no next system: bar N, no number', () => {
    const [start, end] = jumpMarkers(marks([{ origin: 1, target: 4, pass: 1, id: 1 }]), systems, bars, palette);
    expect(start).toMatchObject({ role: 'origin', otherNumber: null });
    expect(end).toMatchObject({ role: 'target', pageIndex: 1, y: 600, height: 200, otherNumber: 1 });
  });

  it('ORG-018 an end beyond the usable prefix gets no marker; the start keeps its place', () => {
    const result = jumpMarkers(marks([{ origin: 1, target: 9, pass: 1, id: 1 }]), systems, bars, palette);
    expect(result.map((m) => m.role)).toEqual(['origin']);
  });

  it('ORG-018 markers follow the creation order of the jumps', () => {
    const result = jumpMarkers(marks([{ origin: 1, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 1, id: 2 }]), systems, bars, palette);
    expect(result.filter((m) => m.role === 'origin').map((m) => m.jumpId)).toEqual([1, 2]);
  });
});

describe('JumpMarkers', () => {
  const marker = (over: Partial<JumpMarker>): JumpMarker => ({
    jumpId: 1, role: 'origin', pageIndex: 0, y: 100, height: 100, otherNumber: 3, otherJunction: 2, pass: 2, colorIndex: 0, ...over,
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

  it('ORG-018 a start shows the rotated split icon, the target system number and the pass in the jump color', async () => {
    const fixture = mount([marker({ colorIndex: 2 })]);
    await fixture.whenStable();
    const [el] = markersOf(fixture);
    expect(el!.querySelector('app-icon use')!.getAttribute('href')).toContain(TUNABLES.icons.jump);
    expect(el!.querySelector('[data-testid="jump-marker-number"]')!.textContent).toBe('3');
    expect(el!.querySelector('[data-testid="jump-marker-pass"]')!.textContent).toBe(`${TUNABLES.layout.passPrefix}2`);
    expect(el!.style.background).not.toBe('');
    expect(el!.closest('.group')!.classList.contains('start')).toBe(true);
  });

  it('ORG-018 an end shows the merge icon and the source system number, no pass, on the left', async () => {
    const fixture = mount([marker({ role: 'target', otherNumber: 4 })]);
    await fixture.whenStable();
    const [el] = markersOf(fixture);
    expect(el!.querySelector('app-icon use')!.getAttribute('href')).toContain(TUNABLES.icons.jumpEnd);
    expect(el!.querySelector('[data-testid="jump-marker-number"]')!.textContent).toBe('4');
    expect(el!.querySelector('[data-testid="jump-marker-pass"]')).toBeNull();
    expect(el!.closest('.group')!.classList.contains('end')).toBe(true);
  });

  it('ORG-018 a marker without a number shows only the icon (and the pass for a start)', async () => {
    const fixture = mount([marker({ role: 'target', otherNumber: null })]);
    await fixture.whenStable();
    expect(markersOf(fixture)[0]!.querySelector('[data-testid="jump-marker-number"]')).toBeNull();
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
