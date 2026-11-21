import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

const FIXTURES = 'e2e/fixtures';
const SCORE_NAME = 'IMSLP799145-PMLP14377-tiff2pdf_-2.pdf';
const FAILURE_CASES = ['blank-page.pdf', 'damaged.pdf', 'encrypted.pdf', 'zero-pages.pdf'];
const bytesOf = (file: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, file)));
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

describe('failure-case fixtures', () => {
  it('TST-016 only the failure-case PDFs stay in e2e/fixtures', () => {
    expect(readdirSync(FIXTURES).sort()).toEqual(FAILURE_CASES);
  });

  it('TST-016 the damaged fixture has no PDF header and cannot be parsed', async () => {
    const bytes = bytesOf('damaged.pdf');
    expect(new TextDecoder('latin1').decode(bytes.subarray(0, 5))).not.toBe('%PDF-');
    await expect(PDFDocument.load(bytes)).rejects.toThrow();
  });

  it('TST-016 the zero-page fixture is a valid PDF without pages', async () => {
    expect((await PDFDocument.load(bytesOf('zero-pages.pdf'))).getPageCount()).toBe(0);
  });

  it('TST-016 the blank-page fixture has one page and no content', async () => {
    const doc = await PDFDocument.load(bytesOf('blank-page.pdf'));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).node.Contents()).toBeUndefined();
  });

  it('TST-016 the encrypted fixture carries an encryption dictionary and is refused without ignoring it', async () => {
    const bytes = bytesOf('encrypted.pdf');
    expect(new TextDecoder('latin1').decode(bytes)).toContain('/Encrypt');
    await expect(PDFDocument.load(bytes)).rejects.toThrow();
  });
});

describe('no generated test scores', () => {
  it('TST-016 the generators of synthetic scores and of the large reference PDF are gone', () => {
    for (const path of ['scripts/make-corpus.mjs', 'scripts/make-large-pdf.mjs', 'scripts/lib/pdf-pieces.mjs', 'e2e/perf/reference-120.pdf']) {
      expect(existsSync(path), path).toBe(false);
    }
    const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }).scripts;
    expect(Object.keys(scripts).filter((name) => /^make:(corpus|large-pdf)$/.test(name))).toEqual([]);
    expect(scripts['make:test-pdfs']).toBeDefined();
  });

  it('TST-016 no synthetic score or generated corpus PDF is left and no file refers to one', () => {
    const forbidden = ['synthetic' + '-score', 'engraved-clean', 'engraved-single', 'flat-staves', 'scanned-noise', 'title-then-score'];
    const files = [...walk('e2e'), ...walk('src/testing'), ...walk('scripts')].filter((path) => !path.includes('/cache/') && !path.endsWith('fixtures.spec.ts'));
    expect(files.filter((path) => path.endsWith('.pdf') && !path.startsWith(`${FIXTURES}/`) && !path.startsWith('e2e/corpus/real/'))).toEqual([]);
    const referring = files.filter((path) => /\.(ts|mjs|json)$/.test(path) && forbidden.some((word) => readFileSync(path, 'utf8').includes(word)));
    expect(referring).toEqual([]);
  });

  it('TST-016 the standard test score is a real corpus PDF with an entry in expected.json that the e2e support reads', () => {
    expect(existsSync(`e2e/corpus/real/${SCORE_NAME}`)).toBe(true);
    const entries = JSON.parse(readFileSync('e2e/corpus/expected.json', 'utf8')) as { file: string; systemsPerPage: number[] }[];
    expect(entries.find((candidate) => candidate.file === SCORE_NAME)?.systemsPerPage.length, 'expected.json has an entry for the standard score').toBeGreaterThan(0);
    const support = readFileSync('e2e/support/score.ts', 'utf8');
    expect(support).toContain(`SCORE_NAME = '${SCORE_NAME}'`);
    expect(support).toContain("e2e/corpus/expected.json");
  });
});
