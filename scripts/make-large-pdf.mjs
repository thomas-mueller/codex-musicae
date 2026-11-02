// Generates the 120-page reference PDF of the performance tests (M17 S3, TST-008) in e2e/perf/. Same bytes on every run.
import { mkdir, writeFile } from 'node:fs/promises';
import { A4, A4_SYSTEM_TOPS, MARGIN, makeRandom, newDoc, save, drawSystem, scanPage } from './lib/pdf-pieces.mjs';

const OUT_FILE = 'e2e/perf/reference-120.pdf';
const SEED = 0x120ef;
const VECTOR_PAGES = 100;
const RASTER_PAGES = 20;

const doc = await newDoc('Reference score, 120 pages');
for (let p = 0; p < VECTOR_PAGES; p++) {
  const page = doc.addPage(A4);
  for (const top of A4_SYSTEM_TOPS) drawSystem(page, A4[1], top, MARGIN, A4[0] - MARGIN);
}
// One noisy scan, embedded once and drawn on every raster page: the file stays small and generation fast; the decoded bitmaps are as large as ever.
const scan = await doc.embedPng(scanPage(makeRandom(SEED), false));
for (let p = 0; p < RASTER_PAGES; p++) {
  const page = doc.addPage(A4);
  page.drawImage(scan, { x: 0, y: 0, width: A4[0], height: A4[1] });
}

await mkdir('e2e/perf', { recursive: true });
await writeFile(OUT_FILE, await save(doc));
console.log(`wrote ${OUT_FILE} (${VECTOR_PAGES + RASTER_PAGES} pages)`);
