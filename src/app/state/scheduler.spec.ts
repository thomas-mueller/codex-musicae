import { TestBed } from '@angular/core/testing';

import { Scheduler } from './scheduler';

interface Gate<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function gate<T = void>(): Gate<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('Scheduler', () => {
  let scheduler: Scheduler;
  beforeEach(() => {
    scheduler = TestBed.inject(Scheduler);
  });

  it('NFR-003 runs a task and resolves its value', async () => {
    expect(await scheduler.submit('visible', () => Promise.resolve(7))).toEqual({ ok: true, value: 7 });
  });

  it('NFR-003 runs one task per class at a time, higher priority first', async () => {
    const order: string[] = [];
    const first = gate();
    const a = scheduler.submit('visible', async () => {
      order.push('v1');
      await first.promise;
    });
    const b = scheduler.submit('visible', () => {
      order.push('v2');
      return Promise.resolve();
    });
    const p = scheduler.submit('prefetch', () => {
      order.push('p1');
      return Promise.resolve();
    });
    await flush();
    expect(order).toEqual(['v1', 'p1']);
    first.resolve();
    await Promise.all([a, b, p]);
    expect(order).toEqual(['v1', 'p1', 'v2']);
  });

  it('NFR-003 a visible task aborts a running prefetch task', async () => {
    const hold = gate();
    let aborted = false;
    const prefetch = scheduler.submit('prefetch', (signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        hold.resolve();
      });
      return hold.promise;
    });
    await flush();
    const visible = await scheduler.submit('visible', () => Promise.resolve('v'));
    expect(aborted).toBe(true);
    expect(visible).toEqual({ ok: true, value: 'v' });
    expect(await prefetch).toEqual({ ok: false, error: 'cancelled' });
  });

  it('NFR-003 a visible task does not abort a running save task', async () => {
    const hold = gate();
    let aborted = false;
    const save = scheduler.submit('save', (signal) => {
      signal.addEventListener('abort', () => (aborted = true));
      return hold.promise;
    });
    await flush();
    await scheduler.submit('visible', () => Promise.resolve());
    expect(aborted).toBe(false);
    hold.resolve();
    expect(await save).toEqual({ ok: true, value: undefined });
  });

  it('NFR-003 detection waits while the user is active', async () => {
    scheduler.setContext({ userActive: true });
    let ran = false;
    const detection = scheduler.submit('detection', () => {
      ran = true;
      return Promise.resolve();
    });
    await flush();
    expect(ran).toBe(false);
    scheduler.setContext({ userActive: false });
    await detection;
    expect(ran).toBe(true);
  });

  it('NFR-008 setViewKey drops queued tasks of another view', async () => {
    const hold = gate();
    scheduler.setViewKey('A');
    const running = scheduler.submit('visible', () => hold.promise, { viewKey: 'A' });
    const queued = scheduler.submit('visible', () => Promise.resolve(1), { viewKey: 'A' });
    await flush();
    scheduler.setViewKey('B');
    expect(await queued).toEqual({ ok: false, error: 'cancelled' });
    hold.resolve();
    expect(await running).toEqual({ ok: false, error: 'cancelled' });
  });

  it('NFR-008 setViewKey aborts the signal of a running stale task', async () => {
    const hold = gate();
    let aborted = false;
    scheduler.setViewKey('A');
    const task = scheduler.submit(
      'visible',
      (signal) => {
        signal.addEventListener('abort', () => (aborted = true));
        return hold.promise;
      },
      { viewKey: 'A' },
    );
    await flush();
    scheduler.setViewKey('B');
    expect(aborted).toBe(true);
    hold.resolve();
    await task;
  });

  it('NFR-008 a task for an outdated view is cancelled at submit', async () => {
    scheduler.setViewKey('B');
    expect(await scheduler.submit('visible', () => Promise.resolve(), { viewKey: 'A' })).toEqual({
      ok: false,
      error: 'cancelled',
    });
  });

  it('NFR-008 tasks without a view key are not affected by view changes', async () => {
    const task = scheduler.submit('visible', () => Promise.resolve(3));
    scheduler.setViewKey('B');
    expect(await task).toEqual({ ok: true, value: 3 });
  });

  it('NFR-003 a failing task frees its slot', async () => {
    const failed = await scheduler.submit('visible', () => Promise.reject(new Error('x')));
    expect(failed).toEqual({ ok: false, error: 'cancelled' });
    expect(await scheduler.submit('visible', () => Promise.resolve(1))).toEqual({ ok: true, value: 1 });
  });
});
