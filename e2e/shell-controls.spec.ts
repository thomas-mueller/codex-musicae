import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { TUNABLES } from '../src/config/tunables';
import { clickMode } from './support/modes';

const en = JSON.parse(readFileSync('src/assets/i18n/en.json', 'utf8')) as { a11y: Record<string, string> };
const label = (key: string) => en.a11y[key] as string;

/** aria-labels of all visible controls, in DOM order (the sprite-based buttons, indicators and sliders). */
async function labels(page: Page, area: 'top' | 'bottom' | 'tools'): Promise<string[]> {
  const root = area === 'tools' ? 'app-tool-area' : `[data-area="${area}"]`;
  return page.locator(`${root} [aria-label]`).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
}

const sizes = {
  compact: { width: 360, height: 800 },
  expanded: { width: 1280, height: 800 },
} as const;

for (const [sizeClass, viewport] of Object.entries(sizes) as [keyof typeof sizes, { width: number; height: number }][]) {
  test.describe(`${sizeClass} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test(`UIX-004 UIX-005 ${sizeClass} annotation controls match the table`, async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('app-shell')).toHaveAttribute('data-size-class', sizeClass);
      const modes = [label('modeOrganization'), label('modeAnnotation'), label('modePresentation')];
      const slider = sizeClass === 'compact' ? [label('slideIndicator')] : [label('slideSlider'), label('slideIndicator')];
      const common = [label('next'), label('zoomOut'), label('zoomIn'), label('zoomReset')];
      if (sizeClass === 'compact') {
        // UIX-037: narrow, so the mode group holds the one Mode button (both carry its label)
        expect(await labels(page, 'top')).toEqual([
          label('fileBar'), label('openFile'), label('modeSwitch'), label('modeSwitch'), label('settings'),
        ]);
        expect(await labels(page, 'bottom')).toEqual([label('previous'), ...slider, ...common, label('overflow')]);
        expect(await labels(page, 'tools')).toEqual([label('toolFab')]);
      } else {
        expect(await labels(page, 'top')).toEqual([
          label('fileBar'), label('openFile'), label('previousFile'), label('nextFile'), label('modeSwitch'), ...modes, label('saveCopy'), label('settings'),
        ]);
        expect(await labels(page, 'bottom')).toEqual([
          label('previous'), ...slider, ...common, label('showMore'), label('showLess'),
        ]);
        expect(await labels(page, 'tools')).toEqual([
          label('pen'), label('highlighter'), label('eraser'), label('undo'), label('redo'),
        ]);
      }
    });

    test(`UIX-006 ${sizeClass} organization controls match the table`, async ({ page }) => {
      await page.goto('/');
      await clickMode(page, 'modeOrganization');
      await expect(page.locator('app-shell')).toHaveAttribute('data-mode', 'organization');
      const top = await labels(page, 'top');
      expect(top).not.toContain(label('undo'));
      expect(top).not.toContain(label('redo'));
      const bottom = await labels(page, 'bottom');
      expect(bottom).toContain(label('pageIndicator'));
      expect(bottom).not.toContain(label('showMore'));
      if (sizeClass === 'compact') {
        expect(await labels(page, 'tools')).toEqual([label('orgFab')]);
      } else {
        expect(bottom).toContain(label('pageSlider'));
        expect(await labels(page, 'tools')).toEqual([
          label('levelFast'), label('levelStandard'), label('levelFine'), label('markList'),
        ]);
      }
    });

    test(`UIX-007 ${sizeClass} bars are ${TUNABLES.layout.barHeightPx}px high and controls are touch-sized`, async ({ page }) => {
      await page.goto('/');
      for (const area of ['top', 'bottom']) {
        const box = await page.locator(`[data-area="${area}"]`).boundingBox();
        expect(Math.abs((box?.height ?? 0) - TUNABLES.layout.barHeightPx)).toBeLessThanOrEqual(1);
      }
      const boxes = await page
        .locator('app-shell button, app-shell input')
        .evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0));
      expect(boxes.length).toBeGreaterThan(0);
      for (const box of boxes) {
        expect(box.width).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
        expect(box.height).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
      }
    });

    test(`FIL-007 ${sizeClass} document controls are disabled, always-on controls are enabled`, async ({ page }) => {
      await page.goto('/');
      if (sizeClass === 'compact') {
        await page.getByLabel(label('toolFab'), { exact: true }).click(); // UIX-033: undo and redo are in the tool popup
      }
      const disabledControls = () => page.locator('app-shell [aria-disabled="true"], app-shell input:disabled').evaluateAll(
        (els) => els.map((e) => e.getAttribute('aria-label') ?? ''),
      );
      const disabled = new Set(await disabledControls());
      if (sizeClass === 'compact') {
        await page.getByRole('button', { name: label('modeSwitch'), exact: true }).click(); // UIX-037: the modes are in its popup
        for (const name of await disabledControls()) disabled.add(name);
      }
      const fileKeys = sizeClass === 'expanded' ? ['previousFile', 'nextFile', 'saveCopy'] : []; // narrow: no previous/next
      for (const key of ['undo', 'redo', 'previous', 'next', 'zoomOut', 'zoomIn', 'zoomReset', 'modePresentation', ...fileKeys]) {
        expect(disabled.has(label(key)), key).toBe(true);
      }
      const more = sizeClass === 'compact' ? ['overflow', 'modeSwitch'] : [];
      for (const key of ['openFile', 'modeOrganization', 'modeAnnotation', ...more]) {
        expect(disabled.has(label(key)), key).toBe(false);
      }
    });

    test(`UIX-035 ${sizeClass} the settings mode shows the version; there is no info button`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: label('settings'), exact: true }).click();
      await expect(page.locator('app-settings-view').getByLabel(label('versionInfo'), { exact: true })).toHaveText(/^v\d+\.\d+\.\d+$/);
      await expect(page.getByRole('button', { name: 'Info', exact: true })).toHaveCount(0);
    });

    if (sizeClass === 'compact') {
      test('UIX-013 Escape and an outside tap close the More menu', async ({ page }) => {
        await page.goto('/');
        const overflow = page.locator('[data-area="bottom"]').getByLabel(label('overflow'), { exact: true });
        await overflow.click();
        await expect(page.locator('app-popup-host .popup')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator('app-popup-host .popup')).toHaveCount(0);
        await overflow.click();
        await expect(page.locator('app-popup-host .popup')).toHaveCount(1);
        // Firefox phone emulation emits no pointerdown for synthesized clicks (real touches do).
        await page.locator('app-canvas-area').dispatchEvent('pointerdown');
        await expect(page.locator('app-popup-host .popup')).toHaveCount(0);
      });
    } else {
      test('UIX-036 the expanded layout has no More button', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('app-shell')).toHaveAttribute('data-size-class', 'expanded');
        await expect(page.getByRole('button', { name: label('overflow'), exact: true })).toHaveCount(0);
      });
    }
  });
}
