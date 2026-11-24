import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { desktopTest } from './support/desktop';
import { drag, enterAnnotation, enterOrganization, strokeLine, tool, waitForDrawnSlide } from './support/saving';
import { label, openScoreInAnnotation } from './support/score';

// V2-M3 S3, default base URL = the production web build (EDN-014): whatever the user does, the browser keeps nothing.
const LONG_PRESS_MARGIN_MS = 200;
const SWATCH = 3;
const SAMPLE = 0;

async function longPress(page: Page, button: Locator): Promise<void> {
  await button.hover();
  await page.mouse.down();
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await page.mouse.up();
}

/** What the browser keeps for this origin: cookies, both Web Storage areas and the IndexedDB databases. */
async function storedState(context: BrowserContext, page: Page) {
  const inPage = await page.evaluate(async () => ({
    local: globalThis.localStorage.length,
    session: globalThis.sessionStorage.length,
    databases: (await globalThis.indexedDB.databases()).map((db) => db.name),
  }));
  return { cookies: await context.cookies(), ...inPage };
}

desktopTest('EDN-014 EDN-016 the web build stores no cookie, localStorage, sessionStorage or IndexedDB data and starts empty', async ({ page }) => {
  const context = page.context();
  await openScoreInAnnotation(page);
  await waitForDrawnSlide(page);

  // change a setting: pen color and width
  await tool(page, 'pen').click();
  await longPress(page, tool(page, 'pen'));
  await page.locator('app-tool-popup .swatch').nth(SWATCH).click();
  await page.locator('app-tool-popup .sample').nth(SAMPLE).click();
  const area = (await page.locator('app-canvas-area .content').boundingBox())!;
  await page.mouse.click(area.x + 3, area.y + area.height / 2);
  await expect(page.locator('app-tool-popup')).toHaveCount(0);

  // draw, switch modes, zoom, open the overflow menu
  const line = await strokeLine(page);
  await drag(page, line.from, line.to);
  await enterOrganization(page);
  await enterAnnotation(page);
  await page.getByRole('button', { name: label('zoomIn'), exact: true }).click();
  await page.getByRole('button', { name: label('overflow'), exact: true }).click();
  await page.waitForTimeout(TUNABLES.persistence.sessionDebounceMs * 3); // longer than any debounced write would take

  expect(await storedState(context, page)).toEqual({ cookies: [], local: 0, session: 0, databases: [] });

  // the next start is empty: no restored tab, still nothing stored
  await page.reload();
  await expect(page.locator('app-tab-bar .name')).toHaveCount(0);
  expect(await storedState(context, page)).toEqual({ cookies: [], local: 0, session: 0, databases: [] });
});

desktopTest('EDN-015 the service worker still serves the app from its own cache without storing user data', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'EDN-015 offline service-worker coverage is Chromium-only (as PLT-009)');
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(() => globalThis.navigator.serviceWorker.ready);
  await page.reload({ waitUntil: 'networkidle' });
  await expect.poll(() => page.evaluate(() => globalThis.navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(TUNABLES.identity.appName);
  await context.setOffline(false);
  expect(await storedState(context, page)).toEqual({ cookies: [], local: 0, session: 0, databases: [] });
});
