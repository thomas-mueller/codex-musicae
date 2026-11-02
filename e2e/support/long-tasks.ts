import type { Page } from '@playwright/test';

type WithLongTasks = { __longTasksMs?: number[] };

/** Chromium only (CDP): slows the main thread by `rate`. Returns a function that restores the normal speed. */
export async function throttleCpu(page: Page, rate: number): Promise<() => Promise<void>> {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate });
  return async () => {
    await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await session.detach();
  };
}

/** Starts collecting the durations of main-thread long tasks (PerformanceObserver 'longtask'). */
export async function startLongTaskObserver(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = globalThis as unknown as WithLongTasks;
    store.__longTasksMs = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        store.__longTasksMs?.push(entry.duration);
      }
    }).observe({ entryTypes: ['longtask'] });
  });
}

/** The longest long task since `startLongTaskObserver`; 0 when there was none. */
export async function longestLongTaskMs(page: Page): Promise<number> {
  return page.evaluate(() => Math.max(0, ...((globalThis as unknown as WithLongTasks).__longTasksMs ?? [])));
}
