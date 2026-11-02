import { expect, type Page } from '@playwright/test';

import { label } from './score';

/** The browser-side objects the specs poke at (the lint rules keep bare platform globals out of e2e code). */
interface BrowserGlobals {
  document: { fullscreenElement: Element | null };
  navigator: object;
  __wakeLog?: string[];
}
// Playwright serializes the callbacks below into the page, so each one casts `globalThis` itself.

export const isFullscreen = (page: Page): Promise<boolean> => page.evaluate(() => (globalThis as unknown as BrowserGlobals).document.fullscreenElement !== null);

/** Replaces navigator.wakeLock by a recorder; the events are appended to the array `wakeLog` returns. */
export async function recordWakeLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    const globals = globalThis as unknown as BrowserGlobals;
    globals.__wakeLog = log;
    Object.defineProperty(globals.navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: () => {
          log.push('acquire');
          const sentinel = { released: false, release: () => { sentinel.released = true; log.push('release'); return Promise.resolve(); } };
          return Promise.resolve(sentinel);
        },
      },
    });
  });
}

export const wakeLog = (page: Page): Promise<string[]> => page.evaluate(() => (globalThis as unknown as BrowserGlobals).__wakeLog ?? []);

/** Removes the Fullscreen and Wake Lock APIs (iPhone Safari-like). */
export async function removeFullscreenAndWakeLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const globals = globalThis as unknown as { navigator: object; Element: { prototype: object }; Navigator: { prototype: object } };
    Object.defineProperty(globals.Navigator.prototype, 'wakeLock', { configurable: true, value: undefined });
    for (const name of ['requestFullscreen', 'webkitRequestFullscreen']) {
      Object.defineProperty(globals.Element.prototype, name, { configurable: true, value: undefined });
    }
  });
}

/**
 * Presses Escape until presentation mode has ended. WebKit drops keys while its fullscreen transition runs, and the
 * transition outlasts `fullscreenElement` becoming set, so a single press right after entering can be lost.
 */
export async function leavePresentationWithEscape(page: Page): Promise<void> {
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(page.locator('app-shell')).toHaveAttribute('data-mode', 'annotation', { timeout: ESCAPE_RETRY_MS });
  }).toPass();
}
const ESCAPE_RETRY_MS = 1000;

export const modeButton = (page: Page, key: 'modePresentation' | 'modeAnnotation') => page.getByLabel(label(key), { exact: true });
