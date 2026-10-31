// Generates the deterministic test PDFs in e2e/fixtures/ (M8 S2). Same bytes on every run.
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const OUT_DIR = 'e2e/fixtures';
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PAGES = 3;
const SYSTEM_TOPS = [100, 280, 460, 640]; // from the top of the page
const STAFF_X0 = 50;
const STAFF_X1 = 545;
const LINE_COUNT = 5;
const LINE_SPACING = 5;
const STAFF_DISTANCE = 40;
const INNER_BARLINES = 3;
const NOTE_SIZE = 4;
const TITLE_SIZE = 18;
const TITLE_Y_FROM_TOP = 60;
const FIXED_DATE = new Date(Date.UTC(2024, 0, 1));
const DAMAGED_BYTES = 2048;
const DAMAGED_SEED = 0x2f6e2b1;

const black = rgb(0, 0, 0);
const toY = (fromTop) => PAGE_HEIGHT - fromTop;

function drawSystem(page, top) {
  const staffBottoms = [0, 1].map((s) => top + s * STAFF_DISTANCE + (LINE_COUNT - 1) * LINE_SPACING);
  for (let s = 0; s < 2; s++) {
    for (let l = 0; l < LINE_COUNT; l++) {
      const y = toY(top + s * STAFF_DISTANCE + l * LINE_SPACING);
      page.drawLine({ start: { x: STAFF_X0, y }, end: { x: STAFF_X1, y }, thickness: 0.5, color: black });
    }
  }
  const barTop = toY(top);
  const barBottom = toY(staffBottoms[1]);
  const span = STAFF_X1 - STAFF_X0;
  for (let b = 0; b <= INNER_BARLINES + 1; b++) {
    const x = STAFF_X0 + (span * b) / (INNER_BARLINES + 1);
    page.drawLine({ start: { x, y: barTop }, end: { x, y: barBottom }, thickness: 0.8, color: black });
  }
  for (let n = 0; n < 6; n++) {
    page.drawRectangle({
      x: STAFF_X0 + 20 + n * 40,
      y: toY(top + (n % LINE_COUNT) * LINE_SPACING) - NOTE_SIZE / 2,
      width: NOTE_SIZE,
      height: NOTE_SIZE,
      color: black,
    });
  }
}

async function makeScore() {
  const doc = await PDFDocument.create();
  doc.setTitle('Synthetic score');
  doc.setProducer('codex-musicae test generator');
  doc.setCreator('codex-musicae test generator');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 0; p < PAGES; p++) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    if (p === 0) {
      page.drawText('Synthetic Score', { x: STAFF_X0, y: toY(TITLE_Y_FROM_TOP), size: TITLE_SIZE, font, color: black });
    }
    for (const top of SYSTEM_TOPS) {
      drawSystem(page, top);
    }
  }
  return doc.save({ useObjectStreams: false });
}

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

await mkdir(OUT_DIR, { recursive: true });
await writeFile(`${OUT_DIR}/synthetic-score.pdf`, await makeScore());
await writeFile(`${OUT_DIR}/damaged.pdf`, makeDamaged());
console.log(`wrote ${OUT_DIR}/synthetic-score.pdf and ${OUT_DIR}/damaged.pdf`);
