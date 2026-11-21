import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isReviewed,
  listCorpusPdfs,
  mergeProposals,
  selectToMeasure,
  serializeExpected,
  type CorpusPdf,
  type ExpectedEntry,
} from '../../scripts/lib/make-expected.mjs';

const V1: ExpectedEntry = { file: 'v1.pdf', level: 'standard', systemsPerPage: [4], note: 'checked by hand', knownLimitation: null };
const REVIEWED: ExpectedEntry = { ...V1, file: 'reviewed.pdf', source: 'folder', note: 'my note', knownLimitation: 'two staves merge', reviewed: true };
const DRAFT: ExpectedEntry = { ...V1, file: 'draft.pdf', source: 'url', systemsPerPage: [1], note: 'draft note', reviewed: false };
const pdf = (file: string, source: 'folder' | 'url' = 'folder'): CorpusPdf => ({ file, source });

describe('expectation helper selection', () => {
  it('TST-014 an entry without a reviewed key (V1) counts as reviewed, only reviewed:false is a draft', () => {
    expect(isReviewed(V1)).toBe(true);
    expect(isReviewed(REVIEWED)).toBe(true);
    expect(isReviewed(DRAFT)).toBe(false);
  });

  it('TST-014 only new PDFs and PDFs with an unreviewed entry are measured, all of them with force', () => {
    const pdfs = [pdf('v1.pdf'), pdf('reviewed.pdf'), pdf('draft.pdf', 'url'), pdf('new.pdf')];
    const entries = [V1, REVIEWED, DRAFT];
    expect(selectToMeasure({ pdfs, entries }).map((p) => p.file)).toEqual(['draft.pdf', 'new.pdf']);
    expect(selectToMeasure({ pdfs, entries, force: true }).map((p) => p.file)).toEqual(['v1.pdf', 'reviewed.pdf', 'draft.pdf', 'new.pdf']);
  });

  it('TST-013 the corpus lists folder and cache PDFs sorted and takes the folder file when a name is in both', () => {
    const { pdfs, warnings } = listCorpusPdfs({ realFiles: ['b.pdf', 'notes.txt', 'a.PDF'], cacheFiles: ['b.pdf', 'c.pdf'] });
    expect(pdfs).toEqual([pdf('a.PDF'), pdf('b.pdf'), pdf('c.pdf', 'url')]);
    expect(warnings).toHaveLength(1);
  });
});

describe('expectation helper merge', () => {
  it('TST-013 a new PDF gets a complete unreviewed entry and a null count is kept with a warning', () => {
    const result = mergeProposals({ entries: [], pdfs: [pdf('new.pdf', 'url')], measured: { 'new.pdf': [3, null] } });
    expect(result.entries).toEqual([
      { file: 'new.pdf', source: 'url', level: 'standard', systemsPerPage: [3, null], note: '', knownLimitation: null, reviewed: false },
    ]);
    expect(result.added).toEqual(['new.pdf']);
    expect(result.warnings).toHaveLength(1);
  });

  it('TST-014 a reviewed entry is not overwritten without force', () => {
    const result = mergeProposals({ entries: [V1, REVIEWED], pdfs: [pdf('v1.pdf'), pdf('reviewed.pdf')], measured: { 'v1.pdf': [9], 'reviewed.pdf': [9] } });
    expect(result.entries).toEqual([V1, REVIEWED]);
    expect(result.kept).toEqual(['v1.pdf', 'reviewed.pdf']);
  });

  it('TST-014 with force a reviewed entry gets new counts, keeps note and limitation and becomes unreviewed', () => {
    const result = mergeProposals({ entries: [REVIEWED], pdfs: [pdf('reviewed.pdf')], measured: { 'reviewed.pdf': [7] }, force: true });
    expect(result.entries).toEqual([{ ...REVIEWED, systemsPerPage: [7], reviewed: false }]);
    expect(result.refreshed).toEqual(['reviewed.pdf']);
  });

  it('TST-014 an unreviewed entry is refreshed and keeps the note and the limitation', () => {
    const result = mergeProposals({ entries: [{ ...DRAFT, knownLimitation: 'noisy' }], pdfs: [pdf('draft.pdf', 'url')], measured: { 'draft.pdf': [2] } });
    expect(result.entries).toEqual([{ ...DRAFT, knownLimitation: 'noisy', systemsPerPage: [2] }]);
  });

  it('TST-014 entries of PDFs that are not present or not measured stay as they are and new entries come last, sorted', () => {
    const result = mergeProposals({
      entries: [V1, REVIEWED],
      pdfs: [pdf('z.pdf'), pdf('a.pdf')],
      measured: { 'z.pdf': [1], 'a.pdf': [2] },
    });
    expect(result.entries.map((entry) => entry.file)).toEqual(['v1.pdf', 'reviewed.pdf', 'a.pdf', 'z.pdf']);
  });
});

describe('expected.json', () => {
  it('TST-013 the expectation text has one entry per line, ends with a newline and parses back to the same entries', () => {
    const entries = [V1, REVIEWED, DRAFT];
    const text = serializeExpected(entries);
    expect(text.endsWith('\n')).toBe(true);
    expect(text.split('\n')).toHaveLength(entries.length + 3);
    expect(JSON.parse(text)).toEqual(entries);
  });

  it('TST-013 the V1 layout of the committed file is reproduced exactly for its entries', () => {
    const text = readFileSync('e2e/corpus/expected.json', 'utf8');
    expect(serializeExpected(JSON.parse(text) as ExpectedEntry[])).toBe(text);
  });

  it('TST-013 every entry of e2e/corpus/expected.json is complete and every PDF of e2e/corpus/real has an entry', () => {
    const entries = JSON.parse(readFileSync('e2e/corpus/expected.json', 'utf8')) as ExpectedEntry[];
    for (const entry of entries) {
      expect(typeof entry.file, entry.file).toBe('string');
      expect(typeof entry.level, entry.file).toBe('string');
      expect(Array.isArray(entry.systemsPerPage) && entry.systemsPerPage.every((n) => n === null || Number.isInteger(n)), entry.file).toBe(true);
      expect(typeof entry.note, entry.file).toBe('string');
      expect(entry.knownLimitation === null || typeof entry.knownLimitation === 'string', entry.file).toBe(true);
    }
    const real = existsSync('e2e/corpus/real') ? readdirSync('e2e/corpus/real').filter((name) => name.toLowerCase().endsWith('.pdf')) : [];
    const missing = real.filter((name) => !entries.some((entry) => entry.file === name));
    expect(missing, 'run npm run corpus to propose entries for these PDFs').toEqual([]);
  });
});

describe('expectation helper command', () => {
  it('TST-014 without PDFs the command has nothing to do, exits 0 and starts no browser', () => {
    const root = mkdtempSync(join(tmpdir(), 'corpus-expected-'));
    try {
      const result = spawnSync(process.execPath, ['scripts/make-expected.mjs', '--root', root], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('nothing to do');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
