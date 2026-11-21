import { test } from '@playwright/test';
import { forceFileInput, openScore } from './support/score';

test('tmp webkit', async ({ page }) => {
  test.setTimeout(200_000);
  page.on('console', (m) => console.log('CONSOLE', m.type(), m.text().slice(0, 300)));
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
  page.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(0, 120), r.failure()?.errorText));
  await forceFileInput(page);
  await page.goto('http://127.0.0.1:4174');
  await openScore(page);
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(15_000);
    console.log('T', i * 15 + 15, await page.evaluate(() => { const h = (globalThis as any).__cm; return JSON.stringify({ c: h.systemCounts?.(), d: h.detectionState?.() , ind: document.querySelector('app-bottom-bar .indicator')?.textContent }); }));
  }
});
