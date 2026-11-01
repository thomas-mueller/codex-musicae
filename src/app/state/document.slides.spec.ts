import { signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { packSlides } from '../core';
import { DocumentStore } from './document.store';
import type { RatioDefaults } from './ratio-defaults';
import { fakeRenderer } from './testing/fake-renderer';

const PAGE = { width: 1000, height: 1400 };

function defaults(over: Partial<RatioDefaults> & { orientation?: () => 'portrait' | 'landscape' } = {}): RatioDefaults {
  return { orientation: () => 'landscape', globalRatio: () => undefined, screenRatio: () => 1.5, ...over };
}

/** `perPage[i]` systems (100 high, 20 apart, full width) on page i; pages with 0 systems are done but empty. */
function docWith(perPage: readonly number[], ratio: RatioDefaults = defaults()): DocumentStore {
  const doc = new DocumentStore('s', fakeRenderer(), ratio);
  doc.detection.reset(perPage.length);
  perPage.forEach((n, pageIndex) => {
    const systems = Array.from({ length: n }, (_, i) => ({ x: 50, y: 100 + i * 300, width: 900, height: 200 }));
    doc.detection.finish(pageIndex, 'done', { pageIndex, ...PAGE, systems });
  });
  return doc;
}

describe('DocumentStore slides (M12 S1)', () => {
  it('SLD-012 padding is matched to a system by page index when page 0 has no systems', () => {
    const doc = docWith([0, 2]);
    const gap = 100; // the only gap in the document, on page 1
    expect(doc.paddings()[1]).toBeCloseTo(gap);
    expect(doc.geoms().map((g) => g.pageIndex)).toEqual([1, 1]);
    expect(doc.geoms()[0]?.padded).toEqual({ x: 0, y: 0, width: 1000, height: 400 });
  });

  it('SLD-012 without systems there are no slides', () => {
    const doc = docWith([0]);
    expect(doc.slides()).toEqual([]);
    expect(doc.slideCount()).toBe(0);
  });

  it('SLD-016 the slide count is final only when detection is complete', () => {
    const doc = new DocumentStore('s', fakeRenderer(), defaults());
    doc.detection.reset(2);
    doc.detection.finish(0, 'done', { pageIndex: 0, ...PAGE, systems: [{ x: 50, y: 100, width: 900, height: 200 }] });
    expect(doc.slideCountIsFinal()).toBe(false);
    doc.detection.finish(1, 'done', { pageIndex: 1, ...PAGE, systems: [] });
    expect(doc.slideCountIsFinal()).toBe(true);
  });

  it('SLD-003 slides equal packSlides over the computed playing order', () => {
    const doc = docWith([3, 3]);
    expect(doc.slides()).toEqual(
      packSlides({
        entries: doc.playingOrder().entries,
        forcedBreakAfter: doc.forcedBreakAfter(),
        systems: doc.geoms(),
        slideWidth: doc.slideWidth(),
        aspectRatio: doc.aspectRatio(),
      }),
    );
    expect(doc.slideCount()).toBeGreaterThan(0);
  });

  it('SLD-014 an override beats the global default beats the screen ratio', () => {
    const doc = docWith([2], defaults({ globalRatio: () => 1.2 }));
    expect(doc.aspectRatio()).toBe(1.2);
    doc.ratioOverride.set({ landscape: 0.8 });
    expect(doc.aspectRatio()).toBe(0.8);
    expect(docWith([2]).aspectRatio()).toBe(1.5);
  });

  it('SLD-015 a change of orientation picks the other override', () => {
    const orientation = signal<'portrait' | 'landscape'>('landscape');
    const doc = docWith([2], defaults({ orientation: () => orientation() }));
    doc.ratioOverride.set({ landscape: 0.8 });
    expect(doc.aspectRatio()).toBe(0.8);
    orientation.set('portrait');
    expect(doc.aspectRatio()).toBe(1.5);
    doc.ratioOverride.set({ landscape: 0.8, portrait: 0.6 });
    expect(doc.aspectRatio()).toBe(0.6);
  });

  it('SLD-012 goToSlide sets entry and system of the first entry of the slide, clamped', () => {
    const doc = docWith([6]);
    const slides = doc.slides();
    expect(slides.length).toBeGreaterThan(1);
    doc.goToSlide(1);
    expect(doc.position().entry).toBe(slides[1]?.entryStart);
    expect(doc.position().system).toBe(doc.playingOrder().entries[slides[1]?.entryStart ?? 0]);
    expect(doc.currentSlideIndex()).toBe(1);
    doc.goToSlide(99);
    expect(doc.currentSlideIndex()).toBe(slides.length - 1);
    doc.goToSlide(-5);
    expect(doc.currentSlideIndex()).toBe(0);
  });

  it('SLD-012 after a jump edit the position follows the system, first occurrence of a repeated one', () => {
    const doc = docWith([4]);
    doc.goToSlide(doc.slideCount() - 1);
    const system = doc.position().system;
    expect(doc.addJump({ origin: 4, target: 0, pass: 1 })).not.toBeNull();
    const entries = doc.playingOrder().entries;
    expect(entries.length).toBeGreaterThan(4);
    expect(doc.position().system).toBe(system);
    expect(doc.position().entry).toBe(entries.indexOf(system));
  });

  it('SLD-012 a ratio change keeps the entry', () => {
    const ratio = signal(1.5);
    const doc = docWith([6], defaults({ screenRatio: () => ratio() }));
    doc.goToSlide(2);
    const before = doc.position();
    doc.ratioOverride.set({ landscape: TUNABLES.aspectRatio.max });
    expect(doc.position()).toEqual(before);
    ratio.set(1);
    expect(doc.position()).toEqual(before);
  });
});
