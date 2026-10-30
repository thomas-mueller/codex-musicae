// AGENTS.md is the single source of truth for the standing agent instructions.
// Usage: node scripts/sync-agent-instructions.mjs [--check]
//   (no flag)  copy AGENTS.md to every mirror
//   --check    exit 1 if a mirror is missing or differs (runs in `npm run lint`)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const source = 'AGENTS.md';
const mirrors = ['CLAUDE.md', '.claude/CLAUDE.md', '.gemini/GEMINI.md'];
const check = process.argv.includes('--check');

const expected = await readFile(join(root, source), 'utf8');
const stale = [];

for (const mirror of mirrors) {
  const path = join(root, mirror);
  const actual = await readFile(path, 'utf8').catch(() => null);
  if (actual === expected) continue;
  if (check) {
    stale.push(mirror);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, expected);
    console.log(`updated ${mirror}`);
  }
}

if (stale.length > 0) {
  console.error(`Out of sync with ${source}: ${stale.join(', ')}. Run: npm run sync:agents`);
  process.exitCode = 1;
}
