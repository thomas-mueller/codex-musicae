import { test, type Page } from '@playwright/test';

const DESKTOP_PROJECTS = ['chromium', 'firefox', 'webkit'];

/** A test driven by mouse, wheel or keyboard: the emulated phone and tablet projects have touch input only. */
export function desktopTest(title: string, body: (args: { page: Page }) => Promise<void>): void {
  test(title, async ({ page }, testInfo) => {
    test.skip(!DESKTOP_PROJECTS.includes(testInfo.project.name), 'mouse, wheel and keyboard input: desktop projects');
    await body({ page });
  });
}
