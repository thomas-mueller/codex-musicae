// Generates the golden detection corpus in e2e/corpus/ (M17 S1, TST-002). Same bytes on every run (fixed seed and dates).
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, rgb } from 'pdf-lib';
import { PNG } from 'pngjs';

const OUT_DIR = 'e2e/corpus';
const FIXED_DATE = new Date(Date.UTC(2024, 0, 1));
const SEED = 0x1c0de5;

// Vector pages: sizes in pt, as in make-test-pdfs.mjs.
const A4 = [595, 842];
const LETTER = [612, 792];
const A3_LANDSCAPE = [1191, 842];
const MARGIN = 50;
const LINE_COUNT = 5;
const LINE_SPACING = 5;
const STAFF_DISTANCE = 40;
const INNER_BARLINES = 3;
const NOTE_SIZE = 4;
const NOTE_COUNT = 6;
const NOTE_STEP = 40;
const NOTE_OFFSET = 20;
const LINE_THICKNESS = 0.5;
const BAR_THICKNESS = 0.8;
const A4_SYSTEM_TOPS = [100, 280, 460, 640];
const SYSTEM_HEIGHT = STAFF_DISTANCE + (LINE_COUNT - 1) * LINE_SPACING;
const FLAT_STAFF_COUNT = 8;
const FLAT_STAFF_PITCH = 90;
const FLAT_FIRST_TOP = 60;
const LOGO_SIZE = 280;
const LOGO_TOP = 200;

// Raster pages: 1654 x 2339 px is A4 at 200 dpi.
const SCAN_WIDTH = 1654;
const SCAN_HEIGHT = 2339;
const PAPER = 245;
const INK = 30;
const NOISE_DENSITY = 0.0005;
const SCAN_MARGIN = 150;
const SCAN_LINE_SPACING = 12;
const SCAN_STAFF_DISTANCE = 100;
const SCAN_LINE_THICKNESS = 2;
const SCAN_BAR_THICKNESS = 3;
const SCAN_SYSTEM_TOPS = [300, 700, 1100, 1500];
const SCAN_BAR_COUNT = INNER_BARLINES + 2;
const FRAME_THICKNESS = 6;

const black = rgb(0, 0, 0);

/** mulberry32: fixed seed, so the "random" noise is the same on every run. */
function makeRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) % 0x1_0000_0000) / 0x1_0000_0000;
  };
}

async function newDoc(title) {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer('codex-musicae corpus generator');
  doc.setCreator('codex-musicae corpus generator');
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  return doc;
}

const save = (doc) => doc.save({ useObjectStreams: false });

/** One staff of five lines; `top` and `x0`/`x1` in pt from the top left of the page. */
function drawStaff(page, height, top, x0, x1) {
  for (let l = 0; l < LINE_COUNT; l++) {
    const y = height - (top + l * LINE_SPACING);
    page.drawLine({ start: { x: x0, y }, end: { x: x1, y }, thickness: LINE_THICKNESS, color: black });
  }
}

/** Two staves joined by barlines: one system (as in the M8 synthetic score). */
function drawSystem(page, height, top, x0, x1) {
  drawStaff(page, height, top, x0, x1);
  drawStaff(page, height, top + STAFF_DISTANCE, x0, x1);
  const span = x1 - x0;
  for (let b = 0; b <= INNER_BARLINES + 1; b++) {
    const x = x0 + (span * b) / (INNER_BARLINES + 1);
    page.drawLine({ start: { x, y: height - top }, end: { x, y: height - top - SYSTEM_HEIGHT }, thickness: BAR_THICKNESS, color: black });
  }
  for (let n = 0; n < NOTE_COUNT; n++) {
    page.drawRectangle({ x: x0 + NOTE_OFFSET + n * NOTE_STEP, y: height - (top + (n % LINE_COUNT) * LINE_SPACING) - NOTE_SIZE / 2, width: NOTE_SIZE, height: NOTE_SIZE, color: black });
  }
}

/** Evenly spread system tops for a page of `height` carrying `count` systems. */
function spreadTops(height, count) {
  const first = height * (A4_SYSTEM_TOPS[0] / A4[1]);
  const pitch = (height - 2 * first) / count;
  return Array.from({ length: count }, (_, i) => Math.round(first + i * pitch));
}

async function engravedClean() {
  const doc = await newDoc('Engraved clean');
  for (let p = 0; p < 3; p++) {
    const page = doc.addPage(A4);
    for (const top of A4_SYSTEM_TOPS) drawSystem(page, A4[1], top, MARGIN, A4[0] - MARGIN);
  }
  return save(doc);
}

async function engravedSingle() {
  const doc = await newDoc('Engraved single');
  const page = doc.addPage(A4);
  drawSystem(page, A4[1], A4_SYSTEM_TOPS[0], MARGIN, A4[0] - MARGIN);
  return save(doc);
}

async function engravedMixedSizes() {
  const doc = await newDoc('Engraved mixed sizes');
  for (const [width, height] of [A4, LETTER, A3_LANDSCAPE]) {
    const page = doc.addPage([width, height]);
    for (const top of spreadTops(height, 3)) drawSystem(page, height, top, MARGIN, width - MARGIN);
  }
  return save(doc);
}

async function flatStaves() {
  const doc = await newDoc('Flat staves');
  const page = doc.addPage(A4);
  // Each staff has its own barline at both ends (it holds its five lines together); nothing joins one staff to the next.
  const staffHeight = (LINE_COUNT - 1) * LINE_SPACING;
  for (let s = 0; s < FLAT_STAFF_COUNT; s++) {
    const top = FLAT_FIRST_TOP + s * FLAT_STAFF_PITCH;
    drawStaff(page, A4[1], top, MARGIN, A4[0] - MARGIN);
    for (const x of [MARGIN, A4[0] - MARGIN]) {
      page.drawLine({ start: { x, y: A4[1] - top }, end: { x, y: A4[1] - top - staffHeight }, thickness: BAR_THICKNESS, color: black });
    }
  }
  return save(doc);
}

async function titleThenScore() {
  const doc = await newDoc('Title then score');
  const logo = doc.addPage(A4);
  logo.drawRectangle({ x: (A4[0] - LOGO_SIZE) / 2, y: A4[1] - LOGO_TOP - LOGO_SIZE, width: LOGO_SIZE, height: LOGO_SIZE, color: black });
  const page = doc.addPage(A4);
  for (const top of A4_SYSTEM_TOPS.slice(0, 3)) drawSystem(page, A4[1], top, MARGIN, A4[0] - MARGIN);
  return save(doc);
}

async function blank() {
  const doc = await newDoc('Blank');
  doc.addPage(A4);
  doc.addPage(A4);
  return save(doc);
}

// ---- raster pages ----

function fillRect(png, x0, y0, width, height) {
  for (let y = y0; y < y0 + height; y++) {
    for (let x = x0; x < x0 + width; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = png.data[i + 1] = png.data[i + 2] = INK;
    }
  }
}

function scanStaff(png, top, x0, x1) {
  for (let l = 0; l < LINE_COUNT; l++) fillRect(png, x0, top + l * SCAN_LINE_SPACING, x1 - x0, SCAN_LINE_THICKNESS);
}

function scanSystem(png, top) {
  const x0 = SCAN_MARGIN;
  const x1 = SCAN_WIDTH - SCAN_MARGIN;
  scanStaff(png, top, x0, x1);
  scanStaff(png, top + SCAN_STAFF_DISTANCE, x0, x1);
  const bottom = top + SCAN_STAFF_DISTANCE + (LINE_COUNT - 1) * SCAN_LINE_SPACING + SCAN_LINE_THICKNESS;
  for (let b = 0; b < SCAN_BAR_COUNT; b++) {
    const x = Math.round(x0 + ((x1 - x0 - SCAN_BAR_THICKNESS) * b) / (SCAN_BAR_COUNT - 1));
    fillRect(png, x, top, SCAN_BAR_THICKNESS, bottom - top);
  }
}

function scanPage(random, withFrame) {
  const png = new PNG({ width: SCAN_WIDTH, height: SCAN_HEIGHT });
  png.data.fill(PAPER);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 0xff;
  for (const top of SCAN_SYSTEM_TOPS) scanSystem(png, top);
  if (withFrame) {
    fillRect(png, 0, 0, SCAN_WIDTH, FRAME_THICKNESS);
    fillRect(png, 0, SCAN_HEIGHT - FRAME_THICKNESS, SCAN_WIDTH, FRAME_THICKNESS);
    fillRect(png, 0, 0, FRAME_THICKNESS, SCAN_HEIGHT);
    fillRect(png, SCAN_WIDTH - FRAME_THICKNESS, 0, FRAME_THICKNESS, SCAN_HEIGHT);
  }
  const speckles = Math.round(SCAN_WIDTH * SCAN_HEIGHT * NOISE_DENSITY);
  for (let n = 0; n < speckles; n++) {
    fillRect(png, Math.floor(random() * SCAN_WIDTH), Math.floor(random() * SCAN_HEIGHT), 1, 1);
  }
  return PNG.sync.write(png, { deflateLevel: 9 });
}

async function scanned(title, withFrame) {
  const random = makeRandom(SEED);
  const doc = await newDoc(title);
  for (let p = 0; p < 2; p++) {
    const image = await doc.embedPng(scanPage(random, withFrame));
    const page = doc.addPage(A4);
    page.drawImage(image, { x: 0, y: 0, width: A4[0], height: A4[1] });
  }
  return save(doc);
}

const FILES = {
  'engraved-clean.pdf': engravedClean,
  'engraved-single.pdf': engravedSingle,
  'engraved-mixed-sizes.pdf': engravedMixedSizes,
  'flat-staves.pdf': flatStaves,
  'title-then-score.pdf': titleThenScore,
  'blank.pdf': blank,
  'scanned-noise.pdf': () => scanned('Scanned noise', false),
  'scanned-frame.pdf': () => scanned('Scanned frame', true),
};

await mkdir(OUT_DIR, { recursive: true });
for (const [name, make] of Object.entries(FILES)) {
  await writeFile(`${OUT_DIR}/${name}`, await make());
}
console.log(`wrote ${Object.keys(FILES).length} PDFs to ${OUT_DIR}`);
