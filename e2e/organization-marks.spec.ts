import { expect, test, type Page } from '@playwright/test';

import { TUNABLES } from '../src/config/tunables';
import { EMPTY_MARKS } from '../src/app/core/edits';
import { markPositions } from '../src/app/core/mark-positions';
import { generatePlayingOrder, systemNumbers } from '../src/app/core/playing-order';
import { label, openScoreInOrganization, SYNTHETIC_BARS, SYNTHETIC_SYSTEMS } from './support/score';
import { RERUN_TIMEOUT_MS, SCROLL_TIMEOUT_MS } from './support/timing';

const SYSTEMS = SYNTHETIC_SYSTEMS;
const FIRST_BAR_INDEX = 0; // junction 0, label 1·1
const PAGE1_BOTTOM_BAR_INDEX = 4; // junction 4, label 1·5
const LAST_BAR_INDEX = SYNTHETIC_BARS - 1; // junction 12
const LONG_PRESS_MARGIN_MS = 200;
const MIDDLE_BAR_INDEX = 1; // the second bar of page 1: junction 1
const EMPTY_SPACE = { x: 5, y: 300 }; // the grey canvas left of the centered page

test.use({ viewport: { width: 1280, height: 800 } });

test('ORG-010 the bars layer stacks above every tile canvas', async ({ page }) => {
  await openScoreInOrganization(page);
  const { overlay, canvases } = await page.evaluate(() => {
    const z = (element: Element): number => Number(getComputedStyle(element).zIndex) || 0;
    const layer = globalThis.document.querySelector('.overlay');
    return { overlay: layer ? z(layer) : -1, canvases: Array.from(globalThis.document.querySelectorAll('app-page-tiles canvas')).map(z) };
  });
  expect(canvases.length).toBeGreaterThan(0);
  expect(overlay).toBeGreaterThan(Math.max(...canvases));
});

test('ORG-013 ORG-014 ORG-022 ORG-023 ORG-024 select a bar, set a break and a stop, delete, deselect', async ({ page }) => {
  await openScoreInOrganization(page);
  const bar = page.getByTestId('org-bar').nth(MIDDLE_BAR_INDEX);
  await bar.click();
  const chip = page.getByTestId('selection-chip');
  await expect(chip).toBeVisible();
  await expect(chip.getByTestId('chip-delete')).toHaveCount(0);
  // Touch targets of the chip buttons (M11 acceptance): the rendered size, not only the tunable.
  for (const button of await chip.getByRole('button').all()) {
    const box = (await button.boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(TUNABLES.layout.minTouchTargetPx - 1);
  }

  await chip.getByTestId('chip-break').click();
  await chip.getByTestId('chip-stop').click();
  await expect(bar.getByTestId('org-bar-break-line')).toHaveCount(1);
  await expect(bar.getByTestId('org-bar-break-icon')).toHaveCount(1);
  await expect(bar.getByTestId('org-bar-stop-icon')).toHaveCount(1);
  await expect(page.locator('[data-testid="system-label"][data-system="1"]')).toHaveText('1');
  await expect(bar.getByTestId('org-bar-numbers')).toHaveCount(0);

  await chip.getByTestId('chip-delete').click();
  await expect(bar.getByTestId('org-bar-break-line')).toHaveCount(0);
  await expect(bar.getByTestId('org-bar-stop-icon')).toHaveCount(0);

  await page.getByTestId('org-viewer').click({ position: EMPTY_SPACE });
  await expect(chip).toHaveCount(0);

  await bar.click();
  await expect(chip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chip).toHaveCount(0);
});

const marker = (page: Page, role: 'origin' | 'target') => page.locator(`[data-testid="jump-marker"][data-role="${role}"]`);
const MAX_LENGTH = TUNABLES.playingOrder.maxLength;
const { listArrow, passPrefix, breakSeparator, unknownNumber } = TUNABLES.layout;
const numberOrDash = (value: number | null): string => (value === null ? unknownNumber : String(value));
const jumpText = (previous: number | null, next: number | null, pass: number): string => `${numberOrDash(previous)} ${listArrow} ${numberOrDash(next)} ${passPrefix}${pass}`;
const systemLabel = (page: Page, system: number) => page.locator(`[data-testid="system-label"][data-system="${system}"]`);

test('ORG-015 ORG-016 ORG-018 ORG-020 create a jump, set the pass, see the markers on the systems, edit and delete it', async ({ page }) => {
  await openScoreInOrganization(page);
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await chip.getByTestId('chip-jump').click();
  await expect(page.getByTestId('org-hint-bar')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('org-hint-bar')).toHaveCount(0);
  await expect(page.getByTestId('jump-marker')).toHaveCount(0);

  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await chip.getByTestId('chip-jump').click();
  await bars.nth(FIRST_BAR_INDEX).click();
  await expect(page.getByTestId('stepper-value')).toHaveText('1');

  // Pass 1: the jump is met after the 4th played system and the 5th one follows; both ends carry that label.
  const jump = { origin: PAGE1_BOTTOM_BAR_INDEX, target: 0, pass: 1, id: 1 };
  const at = (pass: number) => markPositions({ ...EMPTY_MARKS, jumps: [{ ...jump, pass }], nextJumpId: 2 }, SYSTEMS, MAX_LENGTH).jumps.get(1);
  await expect(page.getByTestId('jump-marker')).toHaveCount(2); // one start, one end, although junction 4 has two bars
  const reached = at(1)!;
  await expect(marker(page, 'origin').getByTestId('jump-marker-label')).toHaveText(jumpText(reached.previous, reached.next, 1));
  await expect(marker(page, 'target').getByTestId('jump-marker-label')).toHaveText(jumpText(reached.previous, reached.next, 1));
  const order = generatePlayingOrder({ systemCount: SYSTEMS, jumps: [jump], stops: [], maxLength: MAX_LENGTH });
  const numbers = systemNumbers(order, SYSTEMS)[PAGE1_BOTTOM_BAR_INDEX - 1]!.join(TUNABLES.layout.numberSeparator);
  await expect(systemLabel(page, PAGE1_BOTTOM_BAR_INDEX)).toHaveText(numbers);

  // Pass 2 is never reached (junction 4 is arrived at once): no numbers.
  await page.getByTestId('stepper-plus').click();
  await expect(page.getByTestId('stepper-value')).toHaveText('2');
  await expect(marker(page, 'origin').getByTestId('jump-marker-label')).toHaveText(jumpText(at(2)?.previous ?? null, at(2)?.next ?? null, 2));

  await marker(page, 'origin').click();
  await expect(chip.getByTestId('chip-pass')).toBeVisible();
  await expect(chip.getByTestId('chip-change-target')).toBeVisible();
  await chip.getByTestId('chip-change-target').click();
  await bars.nth(1).click();
  await expect(marker(page, 'origin')).toBeVisible(); // retargeted; the label depends on the playing order only

  await marker(page, 'origin').click();
  await chip.getByTestId('chip-delete').click();
  await expect(page.getByTestId('jump-marker')).toHaveCount(0);
});

test('ORG-016 a second jump from the same bar starts at occurrence 2', async ({ page }) => {
  await openScoreInOrganization(page);
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  for (const [target, pass] of [[FIRST_BAR_INDEX, '1'], [MIDDLE_BAR_INDEX, '2']] as const) {
    await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
    await chip.getByTestId('chip-jump').click();
    await bars.nth(target).click();
    await expect(page.getByTestId('stepper-value')).toHaveText(pass);
  }
});

test('ORG-019 a long press on a marker scrolls to the other end of the jump', async ({ page }) => {
  await openScoreInOrganization(page);
  const viewer = page.getByTestId('org-viewer');
  const bars = page.getByTestId('org-bar');
  await bars.nth(FIRST_BAR_INDEX).click();
  await page.getByTestId('selection-chip').getByTestId('chip-jump').click();
  await viewer.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await bars.nth(LAST_BAR_INDEX).click(); // picking works across pages
  await expect(page.getByTestId('stepper-value')).toHaveText('1');
  await page.keyboard.press('Escape');
  await viewer.evaluate((element) => {
    element.scrollTop = 0;
  });
  // Junctions 0 and N have no system: the start sits on bar 0, the end on bar N.
  const start = marker(page, 'origin');
  // Dispatched pointer events: Playwright's mouse API sends none on emulated-touch Firefox.
  await start.dispatchEvent('pointerdown');
  await page.waitForTimeout(TUNABLES.layout.longPressMs + LONG_PRESS_MARGIN_MS);
  await start.dispatchEvent('pointerup');
  await expect.poll(() => viewer.evaluate((element) => element.scrollTop), { timeout: SCROLL_TIMEOUT_MS }).toBeGreaterThan(0);
});

/** Expanded layouts show the organization tools in a strip; compact ones behind the organization FAB. */
async function openOrganizationTool(page: Page, key: string): Promise<void> {
  const fab = page.getByLabel(label('orgFab'), { exact: true });
  if (await fab.isVisible()) {
    await fab.click();
  }
  await page.getByLabel(label(key), { exact: true }).click();
}

test('ORG-021 the marks list shows jumps, slide breaks and stops in playing order and deletes each kind', async ({ page }) => {
  await openScoreInOrganization(page);
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  const JUNCTION_1_BAR = 1;
  const JUNCTION_2_BAR = 2;
  const JUNCTION_3_BAR = 3;
  const JUNCTION_6_BAR = 7; // page 2: bars 5..9 are junctions 4, 5, 6, 7, 8 (index 5 is the second bar of junction 4)
  // B: 1 -> 2 is created second but is met first in the playing order; A: 4 -> 0 follows; break at 3; stop at 6.
  for (const [from, to] of [[PAGE1_BOTTOM_BAR_INDEX, FIRST_BAR_INDEX], [JUNCTION_1_BAR, JUNCTION_2_BAR]] as const) {
    await bars.nth(from).click();
    await chip.getByTestId('chip-jump').click();
    await bars.nth(to).click();
    await expect(page.getByTestId('stepper-value')).toBeVisible();
  }
  await bars.nth(JUNCTION_3_BAR).click();
  await chip.getByTestId('chip-break').click();
  await bars.nth(JUNCTION_6_BAR).click();
  await chip.getByTestId('chip-stop').click();

  await openOrganizationTool(page, 'markList');
  const entries = page.getByTestId('mark-list-entry');
  await expect(entries).toHaveCount(4);
  await expect(entries.evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset['kind']))).resolves.toEqual(['jump', 'break', 'jump', 'stop']);
  const jumps = [{ origin: PAGE1_BOTTOM_BAR_INDEX, target: 0, pass: 1, id: 1 }, { origin: 1, target: 2, pass: 1, id: 2 }];
  const positions = markPositions({ ...EMPTY_MARKS, jumps, breaks: [3], stops: [6], nextJumpId: 3 }, SYSTEMS, MAX_LENGTH);
  const jumpB = positions.jumps.get(2)!;
  const jumpA = positions.jumps.get(1)!;
  const cut = positions.breaks.get(3)!;
  const stop = positions.stops.get(6)!;
  const label = (index: number) => entries.nth(index).getByTestId('mark-list-label');
  await expect(label(0)).toHaveText(jumpText(jumpB.previous, jumpB.next, 1));
  await expect(label(1)).toHaveText(`${cut.previous} ${breakSeparator} ${cut.next}`);
  await expect(label(2)).toHaveText(jumpText(jumpA.previous, jumpA.next, 1));
  await expect(label(3)).toHaveText(String(stop.previous));
  await expect(page.getByTestId('mark-list')).not.toContainText(unknownNumber);

  for (const kind of ['stop', 'break', 'jump']) {
    await page.locator(`[data-testid="mark-list-entry"][data-kind="${kind}"]`).first().getByTestId('mark-list-delete').click();
  }
  await expect(entries).toHaveCount(1);
});

test('DET-014 DET-015 a confirmed level change keeps the marks and the bars', async ({ page }) => {
  await openScoreInOrganization(page);
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await chip.getByTestId('chip-jump').click();
  await bars.nth(FIRST_BAR_INDEX).click();
  await expect(page.getByTestId('stepper-value')).toHaveText('1');
  const MARKERS_OF_ONE_JUMP = 2;
  await expect(page.getByTestId('jump-marker')).toHaveCount(MARKERS_OF_ONE_JUMP);

  await openOrganizationTool(page, 'levelFine');
  await expect(page.getByTestId('level-dialog')).toBeVisible();
  await page.getByTestId('level-confirm').click();
  await expect(page.getByTestId('level-dialog')).toHaveCount(0);
  await expect(page.getByTestId('detection-progress')).toBeVisible(); // the re-run shows its progress
  await expect(bars).toHaveCount(SYNTHETIC_BARS); // the old bars stay while it runs
  await expect(page.getByTestId('detection-progress')).toHaveCount(0, { timeout: RERUN_TIMEOUT_MS });
  await expect(bars).toHaveCount(SYNTHETIC_BARS);
  await expect(page.getByTestId('jump-marker')).toHaveCount(MARKERS_OF_ONE_JUMP); // 12 systems at both levels: the marks are kept
});

test('ORG-021 on a wide screen the marks list opens beside its button and stays clear of the scroll bar', async ({ page }) => {
  await openScoreInOrganization(page);
  const fab = page.getByLabel(label('orgFab'), { exact: true });
  test.skip(await fab.isVisible(), 'compact layouts show the marks list as a sheet');
  const button = page.getByLabel(label('markList'), { exact: true });
  await button.click();
  const panel = page.getByTestId('mark-list-panel');
  await expect(panel).toBeVisible();
  const buttonBox = (await button.boundingBox())!;
  const panelBox = (await panel.boundingBox())!;
  const viewer = page.getByTestId('org-viewer');
  const viewerBox = (await viewer.boundingBox())!;
  const scrollbarWidth = await viewer.evaluate((element) => element.offsetWidth - element.clientWidth);
  const strip = TUNABLES.layout.toolStripSide;
  if (strip === 'left') {
    expect(panelBox.x).toBeGreaterThanOrEqual(buttonBox.x + buttonBox.width - 1); // right of its button
  } else {
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(buttonBox.x + 1); // left of its button
  }
  expect(panelBox.y).toBeGreaterThanOrEqual(buttonBox.y - 1); // starts at the height of its button
  expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewerBox.x + viewerBox.width - scrollbarWidth + 1); // clear of the scroll bar
});
