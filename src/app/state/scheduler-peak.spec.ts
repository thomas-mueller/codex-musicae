import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { Scheduler } from './scheduler';

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('Scheduler peak (load suite probe)', () => {
  it('TST-025 the peak is zero before any task and counts each class separately', async () => {
    const scheduler = TestBed.inject(Scheduler);
    expect(scheduler.maxRunningPerClass()).toEqual({});
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    const a = scheduler.submit('visible', () => held);
    const b = scheduler.submit('detection', () => held);
    await flush();
    expect(scheduler.maxRunningPerClass()).toEqual({ visible: 1, detection: 1 });
    release();
    await Promise.all([a, b]);
    expect(scheduler.maxRunningPerClass()).toEqual({ visible: 1, detection: 1 }); // a peak stays after the tasks end
  });

  it('TST-025 the peak of a class never exceeds the cap even when more tasks are queued', async () => {
    const scheduler = TestBed.inject(Scheduler);
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    const tasks = Array.from({ length: TUNABLES.resources.schedulerMaxPerClass + 3 }, () => scheduler.submit('prefetch', () => held));
    await flush();
    expect(scheduler.maxRunningPerClass()['prefetch']).toBeLessThanOrEqual(TUNABLES.resources.schedulerMaxPerClass);
    release();
    await Promise.all(tasks);
    expect(scheduler.maxRunningPerClass()['prefetch']).toBeLessThanOrEqual(TUNABLES.resources.schedulerMaxPerClass);
  });
});
