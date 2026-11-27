import { expect, test, type Locator, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { readTranslations, serveLongTexts, type Translations } from './support/fit';
import { clickMode } from './support/modes';
import { forceFileInput, scoreBytes, waitForFinalSlideCount } from './support/score';
import { FILE_CHOOSER_TIMEOUT_MS } from './support/timing';

type Texts = { a11y: Record<string, string>; tooltip: Record<string, string> };

/** The controls with a tooltip: the icon buttons and "Reset all settings". */
const CONTROLS = 'button[appiconbutton], button.reset';
const TOLERANCE_PX = 1;
/** A tooltip of more than this many line heights has wrapped. */
const ONE_LINE_LIMIT = 1.5;

/**
 * What is wrong with the tooltip shown in `control`: partly outside the screen or clipped by a container, over its own
 * control, wider than allowed, or hidden behind something else.
 */
async function problems(page: Page, control: Locator): Promise<string[]> {
  const tooltip = control.locator('[role="tooltip"]');
  const found: string[] = [];
  const visible = await tooltip.evaluate(
    (element) =>
      new Promise<number>((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          observer.disconnect();
          resolve(entries[0]!.intersectionRatio);
        });
        observer.observe(element);
      }),
  );
  if (visible < 0.99) {
    found.push(`only ${Math.round(visible * 100)}% visible`);
  }
  const box = (await tooltip.boundingBox())!;
  const own = (await control.boundingBox())!;
  const window = page.viewportSize()!;
  if (box.x < 0 || box.y < 0 || box.x + box.width > window.width + TOLERANCE_PX || box.y + box.height > window.height + TOLERANCE_PX) {
    found.push(`outside the window: ${JSON.stringify(box)}`);
  }
  const overlapX = Math.min(box.x + box.width, own.x + own.width) - Math.max(box.x, own.x);
  const overlapY = Math.min(box.y + box.height, own.y + own.height) - Math.max(box.y, own.y);
  if (overlapX > TOLERANCE_PX && overlapY > TOLERANCE_PX) {
    found.push('covers its control');
  }
  if (box.width > TUNABLES.layout.tooltipMaxWidthPx + TOLERANCE_PX) {
    found.push(`wider than the maximum: ${box.width}`);
  }
  const covered = await tooltip.evaluate((element: HTMLElement) => {
    element.style.pointerEvents = 'auto'; // to be found by hit testing
    const rect = element.getBoundingClientRect();
    const hidden = [0.1, 0.5, 0.9].some((share) => {
      const hit = element.ownerDocument.elementFromPoint(rect.left + rect.width * share, rect.top + rect.height / 2);
      return hit !== element;
    });
    element.style.pointerEvents = '';
    return hidden;
  });
  if (covered) {
    found.push('hidden behind another element');
  }
  return found;
}

async function hover(control: Locator): Promise<void> {
  await control.dispatchEvent('pointerenter', { pointerType: 'mouse' });
  await expect(control.locator('[role="tooltip"]')).toBeAttached();
}

async function unhover(control: Locator): Promise<void> {
  await control.dispatchEvent('pointerleave', { pointerType: 'mouse' });
  await expect(control.locator('[role="tooltip"]')).toHaveCount(0);
}

/** Hovers every visible control below `root` and returns the problems by control name. */
async function checkAll(page: Page, root: string): Promise<string[]> {
  const controls = page.locator(root).locator(CONTROLS).filter({ visible: true });
  await expect(controls.first(), root).toBeVisible(); // a popup that was just opened has rendered
  const count = await controls.count();
  const report: string[] = [];
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    const name = await control.getAttribute('aria-label');
    await hover(control);
    report.push(...(await problems(page, control)).map((problem) => `${root} "${name}": ${problem}`));
    await unhover(control);
  }
  return report;
}

async function openScoreIn(page: Page, texts: Texts): Promise<void> {
  await forceFileInput(page);
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: texts.a11y['openFile'], exact: true }).click();
  await (await chooser).setFiles({ name: 'score.pdf', mimeType: 'application/pdf', buffer: scoreBytes });
  await waitForFinalSlideCount(page);
}

/** Every control of every screen of this window size: three modes, the compact tool and More popups, the narrow mode popup. */
async function checkScreens(page: Page, texts: Texts): Promise<void> {
  const button = (key: string) => page.getByRole('button', { name: texts.a11y[key], exact: true });
  const compact = (await page.locator('app-shell').getAttribute('data-size-class')) === 'compact';
  const report = await checkAll(page, 'app-shell');
  if (compact) {
    await button('toolFab').click();
    report.push(...(await checkAll(page, 'app-tool-area [data-popup]')));
    await button('toolFab').click();
  }
  if (compact) {
    await button('overflow').click();
    report.push(...(await checkAll(page, 'app-popup-host')));
    await button('overflow').click();
  }
  if ((await button('modeSwitch').count()) > 0) {
    await button('modeSwitch').click();
    report.push(...(await checkAll(page, 'app-popup-host')));
    await button('modeSwitch').click();
    await expect(page.locator('app-popup-host .popup')).toHaveCount(0); // or the next click could hit the closing popup
  }
  await clickMode(page, 'modeOrganization', (key) => texts.a11y[key]!);
  await expect(page.getByTestId('org-viewer')).toBeVisible();
  report.push(...(await checkAll(page, 'app-shell')));
  await button('settings').click();
  await expect(page.locator('app-settings-view')).toBeVisible();
  await expect(page.locator('app-bottom-bar')).toHaveCount(0);
  report.push(...(await checkAll(page, 'app-shell')));
  expect(report).toEqual([]);
}

/** A control at each edge of the screen, by name, so a layout change cannot silently leave an edge untested. */
async function checkEdges(page: Page, texts: Texts): Promise<void> {
  const window = page.viewportSize()!;
  const compact = (await page.locator('app-shell').getAttribute('data-size-class')) === 'compact';
  const edges = [
    { key: 'settings', at: { top: true, right: true } },
    { key: 'previous', at: { bottom: true, left: true } },
    { key: compact ? 'overflow' : 'showLess', at: { bottom: true, right: true } },
    ...(compact ? [] : [{ key: 'saveCopy', at: { top: true, right: false } } as const]),
    { key: compact ? 'toolFab' : 'pen', at: { left: true } },
  ] as const;
  for (const { key, at } of edges) {
    const control = page.getByRole('button', { name: texts.a11y[key], exact: true });
    const box = (await control.boundingBox())!;
    const near = TUNABLES.layout.barHeightPx; // the control lies within a bar height of its edges
    const edge = at as Partial<Record<'top' | 'bottom' | 'left' | 'right', boolean>>;
    if (edge.top) expect(box.y, key).toBeLessThan(near);
    if (edge.bottom) expect(window.height - box.y - box.height, key).toBeLessThan(near);
    if (edge.left) expect(box.x, key).toBeLessThan(near);
    if (edge.right) expect(window.width - box.x - box.width, key).toBeLessThan(near);
    // both triggers: the touch long press and the mouse hover
    await control.dispatchEvent('pointerdown', { pointerType: 'touch' });
    await expect(control.locator('[role="tooltip"]')).toHaveText(texts.tooltip[key]!);
    expect(await problems(page, control), `${key} (long press)`).toEqual([]);
    await control.dispatchEvent('pointercancel', { pointerType: 'touch' });
    await expect(control.locator('[role="tooltip"]')).toHaveCount(0);
    await hover(control);
    expect(await problems(page, control), `${key} (hover)`).toEqual([]);
    await unhover(control);
  }
}

const english = readTranslations('en') as unknown as Texts;

async function inEnglish(page: Page): Promise<void> {
  await openScoreIn(page, english);
  await checkEdges(page, english);
  await checkScreens(page, english);
}

// each tooltip waits for its delay
test.describe.configure({ timeout: 240_000 });

// on every project with its own viewport: phones and tablets run it as smoke tests
test('UIX-027 every tooltip stays inside the screen, beside its control, also at every edge', { tag: '@smoke' }, async ({ page }) => {
  await inEnglish(page);
});

for (const viewport of [
  { width: TUNABLES.layout.minSupportedWidthPx, height: 568 },
  { width: 800, height: 360 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`UIX-027 UIX-016 every tooltip stays inside a ${viewport.width}x${viewport.height} screen`, async ({ page }) => {
      await inEnglish(page);
    });
  });
}

test.describe('long German tooltips', () => {
  // the language file is replaced by a route, which a service worker would bypass
  test.use({ serviceWorkers: 'block', locale: 'de-DE', viewport: { width: TUNABLES.layout.minSupportedWidthPx, height: 568 } });

  test('UIX-027 UIX-028 long texts wrap to several lines within the maximum width and stay inside the screen', async ({ page }) => {
    const long = (await serveLongTexts(page, 'de')) as Translations as unknown as Texts;
    await openScoreIn(page, long);
    await page.getByRole('button', { name: long.a11y['settings'], exact: true }).click();
    const reset = page.getByRole('button', { name: long.a11y['resetSettings'], exact: true });
    await hover(reset);
    const lines = await reset.locator('[role="tooltip"]').evaluate((element) => element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).fontSize));
    expect(lines).toBeGreaterThan(ONE_LINE_LIMIT * 2 - 1);
    await unhover(reset);
    await page.getByRole('button', { name: long.a11y['settings'], exact: true }).click();
    await checkEdges(page, long);
    await checkScreens(page, long);
  });
});

test('UIX-027 control: the check reports a tooltip that is off screen or over its control', async ({ page }) => {
  await page.goto('/');
  const control = page.getByRole('button', { name: english.a11y['settings'], exact: true });
  await hover(control);
  expect(await problems(page, control)).toEqual([]);
  await control.locator('[role="tooltip"]').evaluate((element: HTMLElement) => (element.style.left = `${element.ownerDocument.documentElement.clientWidth - 10}px`));
  expect((await problems(page, control)).join()).toContain('outside the window');
  const own = (await control.boundingBox())!;
  await control.locator('[role="tooltip"]').evaluate((element: HTMLElement, at) => Object.assign(element.style, at), { left: `${own.x - 40}px`, top: `${own.y}px` });
  expect(await problems(page, control)).toContain('covers its control');
});
