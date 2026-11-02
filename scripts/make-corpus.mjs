// Generates the golden detection corpus in e2e/corpus/ (M17 S1, TST-002). Same bytes on every run (fixed seed and dates).
import { mkdir, writeFile } from 'node:fs/promises';
import {
  A4, A4_SYSTEM_TOPS, BAR_THICKNESS, black, drawStaff, drawSystem, LINE_COUNT, LINE_SPACING, MARGIN, makeRandom, newDoc, save, scanPage,
} from './lib/pdf-pieces.mjs';

const OUT_DIR = 'e2e/corpus';
const SEED = 0x1c0de5;
const LETTER = [612, 792];
const A3_LANDSCAPE = [1191, 842];
const FLAT_STAFF_COUNT = 8;
const FLAT_STAFF_PITCH = 90;
const FLAT_FIRST_TOP = 60;
const LOGO_SIZE = 280;
const LOGO_TOP = 200;

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

