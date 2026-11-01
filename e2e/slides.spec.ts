import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { label, openScoreInAnnotation, slideCount, waitForBars, waitForFinalSlideCount } from './support/score';
import { DETECTION_TIMEOUT_MS, SCROLL_TIMEOUT_MS, scaled } from './support/timing';

const PAGE1_BOTTOM_BAR_INDEX = 4; // junction 4: end of page 1 (4 systems per page)
const FIRST_BAR_INDEX = 0;
const SHOW_MORE_CLICKS = 8; // 1.6 -> 0.8: clearly taller slides
const CI_JITTER = 2; // the milestone allows x2 for CI

test.use({ viewport: { width: 1280, height: 800 } });

const bar = (page: Page) => page.locator('app-bottom-bar');
const button = (page: Page, key: string) => bar(page).getByRole('button', { name: label(key), exact: true });
const indicator = (page: Page) => bar(page).locator('.indicator');
const slide = (page: Page) => page.getByTestId('slide');

/** The mode click can land before the app reacts (WebKit): repeat until the expected state shows. */
async function enterMode(page: Page, key: 'modeAnnotation' | 'modeOrganization', visible: string): Promise<void> {
  await expect(async () => {
    await page.getByLabel(label(key), { exact: true }).click();
    await expect(page.getByTestId(visible)).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

test('SLD-016 NAV-020 the indicator shows "1 / n"; next and previous move one slide', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  expect(n).toBeGreaterThan(1);
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
  await expect(button(page, 'previous')).toBeDisabled();
  await button(page, 'next').click();
  await expect(indicator(page)).toHaveText(`2 / ${n}`);
  await button(page, 'previous').click();
  await expect(indicator(page)).toHaveText(`1 / ${n}`);
});

test('NAV-020 the slider jumps to a slide', async ({ page }) => {
  const n = await openScoreInAnnotation(page);
  await bar(page).locator('input.slider').fill(String(n));
  await expect(indicator(page)).toHaveText(`${n} / ${n}`);
  await expect(button(page, 'next')).toBeDisabled();
});

test('SLD-017 SLD-013 show more gives fewer slides, show less brings them back', async ({ page }) => {
  const before = await openScoreInAnnotation(page);
  for (let i = 0; i < SHOW_MORE_CLICKS; i++) {
    await button(page, 'showMore').click();
  }
  await expect.poll(() => slideCount(page), { timeout: SCROLL_TIMEOUT_MS }).toBeLessThan(before);
  const fewer = await slideCount(page);
  for (let i = 0; i < SHOW_MORE_CLICKS; i++) {
    await button(page, 'showLess').click();
  }
  await expect.poll(() => slideCount(page), { timeout: SCROLL_TIMEOUT_MS }).toBeGreaterThan(fewer);
});

test('SLD-018 zoom in stretches at once, sharp tiles follow; reset and a slide change return to fit', async ({ page }) => {
  await openScoreInAnnotation(page);
  const tiles = page.locator('[data-testid="slide-tiles"] canvas');
  await expect(tiles).toHaveCount(0);
  await button(page, 'zoomIn').click();
  await expect(slide(page)).toHaveCSS('transform', new RegExp(`matrix\\(${TUNABLES.zoom.buttonStep}`));
  await expect.poll(() => tiles.count(), { timeout: SCROLL_TIMEOUT_MS }).toBeGreaterThan(0);
  await button(page, 'zoomOut').click();
  await expect(slide(page)).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, 0\)|none/);
  await expect(tiles).toHaveCount(0);

  await button(page, 'zoomIn').click();
  await button(page, 'zoomReset').click();
  await expect(slide(page)).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, 0\)|none/);

  await button(page, 'zoomIn').click();
  await button(page, 'next').click();
  await expect(slide(page)).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, 0\)|none/);
  await expect(tiles).toHaveCount(0);
});

test('SLD-003 SLD-012 a repeat 4 -> 0 adds slides', async ({ page }) => {
  const before = await openScoreInAnnotation(page);
  await enterMode(page, 'modeOrganization', 'org-viewer');
  await waitForBars(page);
  const bars = page.getByTestId('org-bar');
  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await page.getByTestId('selection-chip').getByTestId('chip-jump').click();
  await bars.nth(FIRST_BAR_INDEX).click();
  await expect(page.getByTestId('stepper-value')).toHaveText('1');
  await enterMode(page, 'modeAnnotation', 'slide');
  const after = await waitForFinalSlideCount(page);
  expect(after).toBeGreaterThan(before);
});

// Pixel and timing checks use the canvas and the draw calls directly: Chromium only.
test.describe('chromium', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'canvas pixel and timing checks run in Chromium');

  test('SLD-007 SLD-008 the slide canvas holds ink and paper between the grey', async ({ page }) => {
    await openScoreInAnnotation(page);
    await expect
      .poll(
        () =>
          page.getByTestId('slide-canvas').evaluate((canvas: HTMLCanvasElement) => {
            const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data;
            if (!data) {
              return { dark: false, light: false };
            }
            let dark = false;
            let light = false;
            for (let i = 0; i < data.length; i += 4 * 97) {
              const luminance = ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3;
              dark ||= luminance < 60;
              light ||= luminance > 240;
            }
            return { dark, light };
          }),
        { timeout: DETECTION_TIMEOUT_MS },
      )
      .toEqual({ dark: true, light: true });
    // The dimmed filler (CP02-like geometry) is asserted by the unit tests of composeSlide / drawComposition: where the
    // synthetic score's filler falls cannot be hit reliably across engines.
  });

  test('NFR-001 a slide change with a warm cache draws within the budget', async ({ page }) => {
    await openScoreInAnnotation(page);
    await page.evaluate(() => {
      const w = globalThis as unknown as { __draws: number[] };
      w.__draws = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
        w.__draws.push(performance.now());
        return (original as (...a: unknown[]) => void).apply(this, args);
      } as typeof original;
    });
    const draws = () => page.evaluate(() => (globalThis as unknown as { __draws: number[] }).__draws.length);
    // Visit slide 2 and come back: both slides are in the bitmap cache now.
    for (const key of ['next', 'previous']) {
      const seen = await draws();
      await button(page, key).click();
      await expect.poll(draws, { timeout: scaled(SCROLL_TIMEOUT_MS) }).toBeGreaterThan(seen);
    }
    const nextLabel = label('next');
    const elapsed = await page.evaluate(
      (nextName) =>
        new Promise<number>((resolve) => {
          const w = globalThis as unknown as { __draws: number[] };
          const seen = w.__draws.length;
          const next = Array.from(globalThis.document.querySelectorAll<HTMLButtonElement>('app-bottom-bar button')).find(
            (b) => b.getAttribute('aria-label') === nextName,
          );
          const start = performance.now();
          next?.click();
          const poll = (): void => {
            if (w.__draws.length > seen) {
              requestAnimationFrame(() => resolve(performance.now() - start));
            } else {
              requestAnimationFrame(poll);
            }
          };
          poll();
        }),
      nextLabel,
    );
    expect(elapsed).toBeLessThan(TUNABLES.budgets.slideChangeP95Ms * CI_JITTER);
  });
});
