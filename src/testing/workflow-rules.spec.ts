import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const WORKFLOWS = ['lint-test', 'e2e', 'deploy-web', 'android', 'ios'];
const workflow = (name: string): string => readFileSync(`.github/workflows/${name}.yml`, 'utf8').replace(/^\s*#.*$/gm, '');
const config = readFileSync('playwright.config.ts', 'utf8');

describe('workflow and project rules', () => {
  it('PIP-011 every workflow can be started manually', () => {
    for (const name of WORKFLOWS) {
      expect(workflow(name), name).toMatch(/^ {2}workflow_dispatch:/m);
    }
  });

  it('PIP-012 lint-test runs on every branch push, e2e on pull requests to main, on tags v* and manually, not on every push', () => {
    expect(workflow('lint-test')).toMatch(/push:\s*\n\s+branches:\s*\n\s+- '\*\*'/);
    const e2e = workflow('e2e');
    expect(e2e).toMatch(/pull_request:\s*\n\s+branches:\s*\n\s+- main/);
    expect(e2e).toMatch(/push:\s*\n\s+tags:\s*\n\s+- 'v\*'/);
    expect(e2e).not.toMatch(/push:\s*\n\s+branches:/);
    const result = spawnSync(process.execPath, ['scripts/check-workflows.mjs'], { encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });

  it('PIP-016 lint-test writes the coverage table per kind of test to the job summary and uploads it as an artifact', () => {
    const text = workflow('lint-test');
    expect(text).toContain('npm test -- --watch=false --coverage');
    expect(text).toContain('node scripts/coverage-summary.mjs');
    expect(text).toMatch(/actions\/upload-artifact@[\s\S]*coverage\/coverage-summary\.md/);
    expect(readFileSync('scripts/coverage-summary.mjs', 'utf8')).toContain('GITHUB_STEP_SUMMARY');
  });

  it('PIP-017 no workflow, script or test configuration sets a coverage threshold', () => {
    for (const name of WORKFLOWS) {
      expect(workflow(name), name).not.toMatch(/threshold/i);
    }
    expect(readFileSync('angular.json', 'utf8')).not.toMatch(/threshold/i);
    expect(readFileSync('package.json', 'utf8')).not.toMatch(/threshold/i);
  });

  it('TST-009 the Playwright projects cover desktop Chrome, Firefox and Safari, a small and a large Android phone, a tablet, iPhone and iPad', () => {
    for (const project of ['chromium', 'firefox', 'webkit']) {
      expect(config).toContain(`name: '${project}'`);
    }
    for (const [name, device] of [
      ['chromium-small-phone', 'Pixel 7'], ['firefox-small-phone', 'Pixel 7'], ['chromium-pixel-phone', 'Pixel 7'], ['firefox-pixel-phone', 'Pixel 7'],
      ['chromium-galaxy-tablet', 'Galaxy Tab S9'], ['firefox-galaxy-tablet', 'Galaxy Tab S9'], ['webkit-iphone', 'iPhone 13'], ['webkit-ipad', 'iPad Pro 11'],
    ] as const) {
      expect(config, name).toContain(`deviceProject('${name}', `);
      expect(config, name).toMatch(new RegExp(`deviceProject\\('${name}',[^)]*'${device}'`));
    }
    expect(config).toMatch(/SMALL_PHONE_VIEWPORT = \{ width: 360, height: 640 \}/);
    expect(config).toMatch(/deviceProject\('(chromium|firefox)-small-phone', '(chromium|firefox)', 'Pixel 7', SMALL_PHONE_VIEWPORT\)/);
  });

  it('TST-009 the e2e workflow runs the @smoke subset on the small-phone projects', () => {
    const e2e = workflow('e2e');
    for (const project of ['chromium-small-phone', 'firefox-small-phone']) {
      expect(e2e).toMatch(new RegExp(`project: ${project},[^}]*grep: '@smoke'`));
    }
  });
});
