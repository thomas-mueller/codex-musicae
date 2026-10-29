import { defineConfig, devices } from '@playwright/test';

const E2E_BASE_URL = 'http://127.0.0.1:4173';

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
  reporter: 'html',
  use: { baseURL: E2E_BASE_URL, trace: 'on-first-retry' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], browserName: 'firefox' } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], browserName: 'webkit' } },
    ...deviceProjects,
  ],
  webServer: {
    command: 'npm run build && node scripts/serve-static.mjs dist/codexmusicae/browser',
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
  },
});
