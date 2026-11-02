// Requirement traceability (M17 S4, PLT-011, TST-006): every `done` requirement is named by a test or listed with a reason in
// docs/traceability-exceptions.md; every ID a test names exists; no test is skipped without a reason. Writes docs/traceability.md
// (generated, deterministic); with --check it fails instead when that file is stale (used by `npm run lint`).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REQUIREMENTS = 'docs/requirements.md';
const EXCEPTIONS = 'docs/traceability-exceptions.md';
const OUTPUT = 'docs/traceability.md';
const ID = /\b[A-Z][A-Z0-9]{2}-\d{3}\b/g;
const REQUIREMENT_LINE = /^- \*\*([A-Z][A-Z0-9]{2}-\d{3})\*\* \[(v1|v1-optional|v2|backlog)·(todo|done|changed|dropped)·M(\d+)\]/;
const EXCEPTION_LINE = /^- \*\*([A-Z][A-Z0-9]{2}-\d{3})\*\*\s+(\S.*)$/;
const TEST_CALL = /\b(?:it|test|desktopTest|describe)(?:\.\w+)*\s*\(\s*(['"`])/g;
const CASE_TITLE = /caseTitle\([^,()]+,\s*'([^']+)'\)/g;
const FIXTURE_REQ = /\breq:\s*'([^']+)'/g;
const SKIP_CALL = /\b(?:test|it|describe)\.(?:skip|fixme)\s*\(/g;
const check = process.argv.includes('--check');

const idsOf = (text) => text.match(ID) ?? [];

async function walk(dir, accept, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') await walk(path, accept, out);
    } else if (accept(path)) {
      out.push(path);
    }
  }
  return out;
}

/** The text between the quote that opens at `start` and its closing quote (escapes skipped). */
function stringAt(source, start) {
  const quote = source[start];
  let i = start + 1;
  while (i < source.length && source[i] !== quote) i += source[i] === '\\' ? 2 : 1;
  return source.slice(start + 1, i);
}

/** Top-level arguments of the call whose "(" is at `open`. */
function argumentsAt(source, open) {
  const args = [];
  let depth = 0;
  let from = open + 1;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === "'" || c === '"' || c === '`') {
      i += stringAt(source, i).length + 1;
    } else if ('([{'.includes(c)) {
      depth++;
    } else if (')]}'.includes(c)) {
      depth--;
      if (depth === 0) {
        args.push(source.slice(from, i).trim());
        return args.filter((a) => a !== '');
      }
    } else if (c === ',' && depth === 1) {
      args.push(source.slice(from, i).trim());
      from = i + 1;
    }
  }
  return args;
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length;

const requirements = new Map();
for (const line of (await readFile(REQUIREMENTS, 'utf8')).split('\n')) {
  const match = REQUIREMENT_LINE.exec(line);
  if (match) requirements.set(match[1], { target: match[2], status: match[3] });
}

const exceptions = new Map();
for (const line of (await readFile(EXCEPTIONS, 'utf8').catch(() => '')).split('\n')) {
  const match = EXCEPTION_LINE.exec(line);
  if (match) exceptions.set(match[1], match[2]);
}

const violations = [];
const tests = new Map(); // ID -> count
const count = (id, file, line) => {
  if (!requirements.has(id)) {
    violations.push(`${file}:${line}: a test names ${id}, which is not in ${REQUIREMENTS}`);
  } else {
    tests.set(id, (tests.get(id) ?? 0) + 1);
  }
};

const specs = [
  ...(await walk('src', (p) => p.endsWith('.spec.ts'))),
  ...(await walk('e2e', (p) => p.endsWith('.ts'))),
].sort();
const fixtures = await walk('src', (p) => /\/fixtures\/[^/]+\.ts$/.test(p));

for (const file of specs) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(TEST_CALL)) {
    const title = stringAt(source, match.index + match[0].length - 1);
    for (const id of new Set(idsOf(title))) count(id, file, lineOf(source, match.index));
  }
  for (const match of source.matchAll(CASE_TITLE)) {
    for (const id of new Set(idsOf(match[1]))) count(id, file, lineOf(source, match.index));
  }
  // "No silent skips": a skip names its condition and its reason.
  for (const match of source.matchAll(SKIP_CALL)) {
    const args = argumentsAt(source, match.index + match[0].length - 1);
    const quoted = (a) => /^['"`]/.test(a);
    if (args.length < 2 || quoted(args[0]) || !args.slice(1).some(quoted)) {
      violations.push(`${file}:${lineOf(source, match.index)}: a skip needs a condition and a reason string`);
    }
  }
}
for (const file of fixtures) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(FIXTURE_REQ)) {
    for (const id of new Set(idsOf(match[1]))) count(id, file, lineOf(source, match.index));
  }
}

for (const [id, { status }] of requirements) {
  if (status === 'done' && !tests.has(id) && !exceptions.has(id)) {
    violations.push(`${id} is done but no test names it and it is not in ${EXCEPTIONS}`);
  }
}
for (const [id] of exceptions) {
  const requirement = requirements.get(id);
  if (!requirement) violations.push(`${EXCEPTIONS}: ${id} is not in ${REQUIREMENTS}`);
  else if (requirement.status !== 'done') violations.push(`${EXCEPTIONS}: ${id} is ${requirement.status}, not done`);
  else if (tests.has(id)) violations.push(`${EXCEPTIONS}: ${id} has tests now; remove the exception`);
}

const rows = [...requirements].sort(([a], [b]) => a.localeCompare(b)).map(([id, { target, status }]) => {
  const n = tests.get(id) ?? 0;
  return `| ${id} | ${target} | ${status} | ${n} | ${exceptions.has(id) ? 'exception' : ''} |`;
});
const document = [
  '# Traceability',
  '',
  'Generated by `scripts/check-traceability.mjs` (`npm run traceability`); do not edit. Tests = test titles that name the ID plus fixture cases with a `req` field; `exception` = a `done` requirement without an automated test, with its reason in `traceability-exceptions.md`.',
  '',
  '| ID | Target | Status | Tests | Note |',
  '|---|---|---|---|---|',
  ...rows,
  '',
].join('\n');

if (check) {
  if ((await readFile(OUTPUT, 'utf8').catch(() => '')) !== document) {
    violations.push(`${OUTPUT} is stale: run "npm run traceability" and commit it`);
  }
} else {
  await writeFile(OUTPUT, document, 'utf8');
}

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`traceability ok: ${requirements.size} requirements, ${tests.size} with tests, ${exceptions.size} exceptions`);
}
