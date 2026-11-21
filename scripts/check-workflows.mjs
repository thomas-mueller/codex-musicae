// Workflow trigger check (V2-M1 S1, PIP-011, PIP-012): every workflow can be started manually, lint-test runs on every branch push,
// e2e runs on pull requests to main, on tags v* and manually, but not on every push. With a directory argument it checks that copy
// of the workflows (used by the lint self-test); exits non-zero with one line per violation.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = process.argv[2] ?? '.github/workflows';
const NAMES = ['lint-test', 'e2e', 'deploy-web', 'android', 'ios'];
const FOLLOWERS = ['deploy-web', 'android'];
const violations = [];
const code = {};

for (const name of NAMES) {
  const text = await readFile(join(directory, `${name}.yml`), 'utf8').catch(() => null);
  if (text === null) {
    violations.push(`${name}.yml is missing`);
  } else {
    code[name] = text.replace(/^\s*#.*$/gm, '');
  }
}

// The text of one trigger under `on:` (from its key to the next key at the same indent).
const trigger = (text, key) => text.match(new RegExp(`^  ${key}:[^\\n]*\\n((?:    [^\\n]*\\n|\\s*\\n)*)`, 'm'))?.[1];

for (const [name, text] of Object.entries(code)) {
  if (!/^ {2}workflow_dispatch:/m.test(text)) violations.push(`${name}.yml: workflow_dispatch trigger is missing (PIP-011)`);
}

if (code['lint-test']) {
  const push = trigger(code['lint-test'], 'push');
  if (push === undefined || !/branches:\s*\n\s*-\s*'\*\*'/.test(push)) violations.push("lint-test.yml: must run on pushes to every branch (branches: '**') (PIP-012)");
}

if (code.e2e) {
  const text = code.e2e;
  const push = trigger(text, 'push');
  const pullRequest = trigger(text, 'pull_request');
  if (push !== undefined && /branches/.test(push)) violations.push('e2e.yml: must not run on branch pushes (PIP-012)');
  if (push === undefined || !/tags:\s*\n\s*-\s*'v\*'/.test(push)) violations.push("e2e.yml: must run on tags 'v*' (PIP-012)");
  if (pullRequest === undefined || !/branches:\s*\n\s*-\s*main\b/.test(pullRequest)) violations.push('e2e.yml: must run on pull requests to main (PIP-012)');
}

// A manual run has no workflow_run payload: the job must accept it and check out the dispatched commit.
for (const name of FOLLOWERS) {
  const text = code[name];
  if (!text) continue;
  if (!/^\s+if:.*github\.event_name == 'workflow_dispatch'/m.test(text)) violations.push(`${name}.yml: the job condition must accept workflow_dispatch (PIP-011)`);
  if (!/ref:.*workflow_run\.head_sha \|\| github\.sha/.test(text)) violations.push(`${name}.yml: checkout ref must fall back to github.sha (PIP-011)`);
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('workflow triggers ok');
