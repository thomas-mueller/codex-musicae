import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TUNABLES } from '../../config/tunables';
import type { InkStroke } from '../core';
import { DocumentStore } from './document.store';
import { SaveService } from './save.service';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';

const IDLE = TUNABLES.saving.autosaveIdleMs;
const STROKE: InkStroke = { id: 's1', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false };
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('SaveService with saving switched off (V2-M3 S2)', () => {
  it('EDN-001 EDN-002 changes stay unsaved in memory: the marker shows and nothing is ever written', async () => {
    const doc = new DocumentStore('t1', fakeRenderer(), undefined, () => clock.now());
    await doc.load(new Uint8Array([1]));
    const clock = new FakeClock();
    const run = vi.fn(() => Promise.resolve(true));
    const saver = new SaveService(doc, clock, run, IDLE, TestBed.inject(Injector), false);
    TestBed.tick();
    doc.addStroke(STROKE);
    clock.advance(IDLE * 3);
    await saver.force();
    await settle();
    expect(doc.unsaved()).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });
});
