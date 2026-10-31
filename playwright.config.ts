import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = 'http://127.0.0.1:4173';
export const E2E_DEV_BASE_URL = 'http://127.0.0.1:4174';
const IN_CI = Boolean(process.env['CI']);

// Timeouts are generous on purpose: OpenCV and pdf.js are CPU-bound and the CI runners are small (PIP-001).
const TEST_TIMEOUT_MS = 120_000;
const EXPECT_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 15_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const WEB_SERVER_TIMEOUT_MS = 120_000;
const CI_RETRIES = 2;
const CI_WORKERS = 2;

// In CI the workflow builds once (production and development) and uploads the result; the web servers only serve it.
// Locally Playwright still builds before serving, so `npx playwright test` works from a clean checkout.
const buildFirst = (command: string): string => (IN_CI ? '' : `${command} && `);

type DeviceProject = {
  name: string;
  use: Record<string, unknown>;
};

const deviceProject = (
  name: string,
  browserName: 'chromium' | 'firefox' | 'webkit',
  deviceName: string,
): DeviceProject | undefined => {
  const device = devices[deviceName];
  if (!device) {
    return undefined;
  }

  return { name, use: { ...device, browserName } };
};

const deviceProjects = [
  deviceProject('chromium-pixel-phone', 'chromium', 'Pixel 7'),
  deviceProject('chromium-galaxy-tablet', 'chromium', 'Galaxy Tab S9'),
  deviceProject('firefox-pixel-phone', 'firefox', 'Pixel 7'),
  deviceProject('firefox-galaxy-tablet', 'firefox', 'Galaxy Tab S9'),
  deviceProject('webkit-iphone', 'webkit', 'iPhone 13'),
  deviceProject('webkit-ipad', 'webkit', 'iPad Pro 11'),
].filter((project): project is DeviceProject => project !== undefined);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: IN_CI,
  retries: IN_CI ? CI_RETRIES : 0,
  workers: process.env['E2E_WORKERS'] ? Number(process.env['E2E_WORKERS']) : IN_CI ? CI_WORKERS : undefined,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: IN_CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], browserName: 'firefox' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], browserName: 'webkit' } },
    ...deviceProjects,
  ],
  webServer: [
    {
      command: `${buildFirst('npm run build')}node scripts/serve-static.mjs dist/codexmusicae/browser`,
      url: E2E_BASE_URL,
      timeout: WEB_SERVER_TIMEOUT_MS,
      reuseExistingServer: !IN_CI,
    },
    {
      // Development build (ngDevMode): the only one that carries the `window.__cm` debug hook, used by e2e/resource.spec.ts.
      command: `${buildFirst('npm run build -- --configuration development --output-path dist/codexmusicae-dev')}node scripts/serve-static.mjs dist/codexmusicae-dev/browser 4174`,
      url: E2E_DEV_BASE_URL,
      timeout: WEB_SERVER_TIMEOUT_MS,
      reuseExistingServer: !IN_CI,
    },
  ],
});
