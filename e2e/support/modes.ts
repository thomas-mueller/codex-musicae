import { expect, type Page } from '@playwright/test';

import { label } from './score';
import { RETRY_TIMEOUT_MS } from './timing';

export type ModeKey = 'modeOrganization' | 'modeAnnotation' | 'modePresentation';

/**
 * UIX-037: wide screens show the three mode buttons; narrow ones (the phone projects) one "Mode" button that opens them.
 * Opens that choice when needed and returns the button of the mode.
 */
export async function revealMode(page: Page, key: ModeKey, nameOf: (key: string) => string = label) {
  const direct = page.getByRole('button', { name: nameOf(key), exact: true });
  const collapsed = page.getByRole('button', { name: nameOf('modeSwitch'), exact: true });
  await expect(direct.or(collapsed).first()).toBeVisible();
  // The tap can land before the app reacts (WebKit): repeat it until the choice shows.
  await expect(async () => {
    if (!(await direct.isVisible())) {
      await collapsed.click();
    }
    await expect(direct).toBeVisible({ timeout: RETRY_TIMEOUT_MS });
  }).toPass();
  return direct;
}

export async function clickMode(page: Page, key: ModeKey, nameOf: (key: string) => string = label): Promise<void> {
  await (await revealMode(page, key, nameOf)).click();
}
