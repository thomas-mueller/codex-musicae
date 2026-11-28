import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { cutTexts, serveLongTexts } from './support/fit';
import { clickMode, type ModeKey } from './support/modes';

type Texts = { a11y: Record<string, string>; settings: { reset: { question: string } } };

// the language file is replaced by a route, which a service worker would bypass
test.use({ serviceWorkers: 'block', locale: 'de-DE' });

async function start(page: Page) {
  const long = (await serveLongTexts(page, 'de')) as unknown as Texts;
  await page.goto('/');
  const button = (key: string) => page.getByRole('button', { name: long.a11y[key], exact: true });
  await expect(button('settings')).toBeVisible(); // the long texts are in use
  return { long, button };
}

async function expectInsideWindow(page: Page, selector: string): Promise<void> {
  for (const element of await page.locator(selector).all()) {
    await expect(element).toBeInViewport({ ratio: 1 });
  }
}

async function checkEveryScreen(page: Page): Promise<void> {
  const { long, button } = await start(page);
  for (const mode of ['modeAnnotation', 'modeOrganization', 'settings']) {
    await (mode === 'settings' ? button(mode).click() : clickMode(page, mode as ModeKey, (key) => long.a11y[key]!));
    await expectInsideWindow(page, '[data-area="top"] button');
    expect(await cutTexts(page, '[data-area="top"]'), `top bar in ${mode}`).toEqual([]);
  }
  await expect(page.locator('app-settings-view')).toContainText(long.settings.reset.question.split('?')[0]!);
  expect(await cutTexts(page, 'app-settings-view'), 'settings').toEqual([]);
  await button('resetSettings').click();
  await expect(page.getByTestId('reset-dialog')).toContainText(long.settings.reset.question);
  expect(await cutTexts(page, '[data-testid="reset-dialog"]'), 'reset dialog').toEqual([]);
  await expectInsideWindow(page, '[data-testid="reset-dialog"], [data-testid="reset-dialog"] button');
}

// on every project with its own viewport: phones and tablets run it as smoke tests
test('I18-006 long German texts are not cut off in the top bar, the settings and the reset dialog', { tag: '@smoke' }, async ({ page }) => {
  await checkEveryScreen(page);
});

test.describe('at the minimum supported width', () => {
  test.use({ viewport: { width: TUNABLES.layout.minSupportedWidthPx, height: 568 } });

  test('I18-006 UIX-016 long German texts are not cut off at the minimum width', async ({ page }) => {
    await checkEveryScreen(page);
  });

  test('I18-006 control: the fit check reports clipped text and a select that is too narrow', async ({ page }) => {
    const { button } = await start(page);
    await button('settings').click();
    expect(await cutTexts(page, 'app-settings-view')).toEqual([]);
    await page.addStyleTag({
      content: 'app-settings-view h2 { width: 20px !important; overflow: hidden; white-space: nowrap } app-settings-view select { width: 60px !important }',
    });
    const cut = await cutTexts(page, 'app-settings-view');
    expect(cut.filter((text) => text.startsWith('select: '))).toHaveLength(1);
    expect(cut.length).toBeGreaterThan(1);
  });
});
