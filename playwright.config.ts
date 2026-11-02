import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = 'http://127.0.0.1:4173';
export const E2E_DEV_BASE_URL = 'http://127.0.0.1:4174';
const IN_CI = Boolean(process.env['CI']);
// Locally both builds are made and served. In CI only the job that built the development output serves it (E2E_DEV_BUILD=1);
// the specs that need it run on desktop Chromium only.
const WITH_DEV_SERVER = !IN_CI || process.env['E2E_DEV_BUILD'] === '1';

// Timeouts are generous on purpose: OpenCV and pdf.js are CPU-bound and the CI runners are small (PIP-001).
const TEST_TIMEOUT_MS = 120_000;
const EXPECT_TIMEOUT_MS = 15_000;
const ACTION_TIMEOUT_MS = 15_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const WEB_SERVER_TIMEOUT_MS = 120_000;
const CI_RETRIES = 2;
const CI_WORKERS = 2;
// The performance budgets (M17 S3, TST-008) are measured by their own project, opted into with PERF=1 (`npm run e2e:perf`, the CI perf job).
const WITH_PERF = process.env['PERF'] === '1';
const PERF_TEST_TIMEOUT_MS = 300_000;
const PERF_GLOB = '**/e2e/perf/**';

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
  // CI: the log is the report (no artifact storage on a free account): readable list plus GitHub annotations.
  reporter: IN_CI ? [['list'], ['github']] : 'html',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
  },
  projects: [
    ...[
      { name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' as const } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'], browserName: 'firefox' as const } },
      { name: 'webkit', use: { ...devices['Desktop Safari'], browserName: 'webkit' as const } },
      ...deviceProjects,
    ].map((project) => ({ ...project, testIgnore: PERF_GLOB })),
    ...(WITH_PERF
      ? [
          {
            // Chromium only; no retries, so a flaky measurement stays visible.
            name: 'perf',
            testDir: './e2e/perf',
            fullyParallel: false,
            retries: 0,
            workers: 1,
            timeout: PERF_TEST_TIMEOUT_MS,
            use: { ...devices['Desktop Chrome'], browserName: 'chromium' as const },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: `${buildFirst('npm run build')}node scripts/serve-static.mjs dist/codexmusicae/browser`,
      url: E2E_BASE_URL,
      timeout: WEB_SERVER_TIMEOUT_MS,
      reuseExistingServer: !IN_CI,
    },
    ...(WITH_DEV_SERVER
      ? [
          {
            // Development build (ngDevMode): the only one that carries the `window.__cm` debug hook, used by e2e/resource.spec.ts.
            command: `${buildFirst('npm run build -- --configuration development --output-path dist/codexmusicae-dev')}node scripts/serve-static.mjs dist/codexmusicae-dev/browser 4174`,
            url: E2E_DEV_BASE_URL,
            timeout: WEB_SERVER_TIMEOUT_MS,
            reuseExistingServer: !IN_CI,
          },
        ]
      : []),
  ],
});
