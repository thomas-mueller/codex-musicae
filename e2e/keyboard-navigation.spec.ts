import { expect, test, type Page } from '@playwright/test';

import { label, openScoreInAnnotation } from './support/score';

test.use({ viewport: { width: 1280, height: 800 } });

const indicator = (page: Page) => page.locator('app-bottom-bar .indicator');
const shell = (page: Page) => page.locator('app-shell');
const progressWidth = (page: Page): Promise<string> =>
  page.getByTestId('progress-line').evaluate((el) => (el as HTMLElement).style.width);

const NEXT_KEYS = ['PageDown', 'ArrowRight', 'ArrowDown', 'Space'];
const PREVIOUS_KEYS = ['PageUp', 'ArrowLeft', 'ArrowUp', 'Shift+Space'];

test('NAV-002 NAV-003 next and previous keys move one slide in annotation mode', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  expect(n).toBeGreaterThan(2);
  for (const key of NEXT_KEYS) {
    await page.keyboard.press(key);
    await expect(indicator(page)).toHaveText(`2 / ${n}`);
    await page.keyboard.press(PREVIOUS_KEYS[NEXT_KEYS.indexOf(key)]!);
    await expect(indicator(page)).toHaveText(`1 / ${n}`);
  }
});

test('NAV-002 NAV-003 Home and End jump to the first and last slide; there is no wrap-around', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await page.keyboard.press('End');
  await expect(indicator(page)).toHaveText(`${n} / ${n}`);
  await page.keyboard.press('PageDown');
  await expect(indicator(page)).toHaveText(`${n} / ${n}`);
  await page.keyboard.press('Home');
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  await page.keyboard.press('PageUp');
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

test('NAV-002 keys with Ctrl are ignored', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await page.keyboard.press('Control+ArrowRight');
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

test('NAV-019 pedal keys work with a drawing tool active', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await page.getByRole('button', { name: label('pen'), exact: true }).click();
  await page.keyboard.press('PageDown');
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await page.keyboard.press('PageUp');
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

test('NAV-018 NAV-019 presentation mode: keys turn slides and Esc returns to annotation mode', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await page.keyboard.press('PageDown');
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await page.getByLabel(label('modePresentation'), { exact: true }).click();
  await expect(shell(page)).toHaveAttribute('data-mode', 'presentation');
  await expect(page.locator('app-bottom-bar')).toBeHidden(); // UIX-009
  const second = await progressWidth(page);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => progressWidth(page)).not.toBe(second);
  await page.keyboard.press('Shift+Space');
  await expect.poll(() => progressWidth(page)).toBe(second);
  await page.keyboard.press('End');
  await expect.poll(() => progressWidth(page)).toBe('100%');
  await page.keyboard.press('Home');
  await expect.poll(() => progressWidth(page)).toBe('0%');
  await page.keyboard.press('Escape');
  await expect(shell(page)).toHaveAttribute('data-mode', 'annotation');
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});
