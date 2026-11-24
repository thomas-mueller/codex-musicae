// Generates the failure-case PDFs in e2e/fixtures/ (V2-M2 S4, TST-016, D-22): the only synthetic PDFs that stay, because real scores cannot
// cover them. Same bytes on every run, except encrypted.pdf (qpdf picks random keys): it is only written when missing or with --force.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';

const OUT_DIR = 'e2e/fixtures';
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const FIXED_DATE = new Date(Date.UTC(2024, 0, 1));
const DAMAGED_BYTES = 2048;
const DAMAGED_SEED = 0x2f6e2b1;
const ENCRYPTION_BITS = '256';
const PASSWORD = 'secret'; // user and owner password of the encrypted fixture (the app must refuse it without asking)

async function newDoc(title, pages) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer('codex-musicae test generator');
  doc.setCreator('codex-musicae test generator');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  for (let p = 0; p < pages; p++) doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return doc;
}

const save = (doc) => doc.save({ useObjectStreams: false, addDefaultPage: false }); // pdf-lib would add a page to a document without one

/** mulberry32: fixed seed, so the "random" bytes are the same on every run. */
function makeDamaged() {
  let a = DAMAGED_SEED;
  const bytes = new Uint8Array(DAMAGED_BYTES);
  for (let i = 0; i < bytes.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    bytes[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
  }
  bytes[0] = 0x00; // never a PDF header
  return bytes;
}

async function makeEncrypted(force) {
  const target = `${OUT_DIR}/encrypted.pdf`;
  if (existsSync(target) && !force) return 'kept encrypted.pdf (not byte-reproducible; use --force to rewrite it)';
  if (spawnSync('qpdf', ['--version']).status !== 0) return 'skipped encrypted.pdf: qpdf is not installed';
  const plain = `${OUT_DIR}/.encrypted-source.pdf`;
  await writeFile(plain, await save(await newDoc('Encrypted', 1)));
  const result = spawnSync('qpdf', ['--encrypt', PASSWORD, PASSWORD, ENCRYPTION_BITS, '--', plain, target], { encoding: 'utf8' });
  await rm(plain, { force: true });
  return result.status === 0 ? 'wrote encrypted.pdf' : `failed encrypted.pdf: ${result.stderr}`;
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/damaged.pdf`, makeDamaged());
await writeFile(`${OUT_DIR}/zero-pages.pdf`, await save(await newDoc('Zero pages', 0)));
await writeFile(`${OUT_DIR}/blank-page.pdf`, await save(await newDoc('Blank page', 1)));
console.log(`wrote damaged.pdf, zero-pages.pdf and blank-page.pdf in ${OUT_DIR}; ${await makeEncrypted(process.argv.includes('--force'))}`);
