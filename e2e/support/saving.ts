import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

import { TUNABLES } from '../../src/config/tunables';
import { createPdfWriterApi } from '../../src/app/adapters/pdflib/pdf-writer-api';
import { parseMetadata } from '../../src/app/core/metadata';
import { FILE_CHOOSER_TIMEOUT_MS, RETRY_TIMEOUT_MS } from './timing';
import { enterOrganization, forceFileInput, label, scoreBytes } from './score';

const STROKE_STEPS = 20;
const SLIDE_INK_ROW = 0.25;
const STROKE_FROM = 0.2;
const STROKE_TO = 0.6;
const PAGE1_BOTTOM_BAR_INDEX = 4;
const FIRST_BAR_INDEX = 0;
const JUMP_MARKERS = 2; // one start, one end
const COPIES = 2;
const RGBA = 4;
// Reddish whatever the engine's color management does to #D32F2F in a screenshot.
const RED_MIN = 150;
const RED_MAX_OTHER = 120;

const HEX_PREFIX = 1;
const CHANNELS = 3;
const hexRgb = (hex: string): number[] =>
  Array.from({ length: CHANNELS }, (_, i) =>
    parseInt(hex.slice(HEX_PREFIX + i * TUNABLES.pdfWriter.hexDigitsPerChannel, HEX_PREFIX + (i + 1) * TUNABLES.pdfWriter.hexDigitsPerChannel), TUNABLES.pdfWriter.hexRadix),
  );
/** The default pen color as RGB. */
export const RED: readonly number[] = hexRgb(TUNABLES.annotation.defaultPen.color);
export const COLOR_TOLERANCE = 3;
export const KEY = TUNABLES.saving.metadataFileName;

const api = createPdfWriterApi();
const TMP = mkdtempSync(join(tmpdir(), 'e2e-saving-'));
let fileSeq = 0;

/** Forces the <input type="file"> open path and the <a download> save-a-copy path in every engine. Call before `page.goto`. */
export async function forceFilePaths(page: Page): Promise<void> {
  await forceFileInput(page);
  await page.addInitScript(() => {
    delete (globalThis as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
  });
}

/** Opens `bytes` through the file chooser. */
export async function openPdf(page: Page, bytes: Uint8Array | Buffer, name: string): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
}

/** Overflow menu, then "save a copy"; returns the downloaded file's name and bytes. */
export async function saveCopyDownload(page: Page): Promise<{ name: string; bytes: Buffer }> {
  await page.getByRole('button', { name: label('overflow'), exact: true }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: label('saveCopy'), exact: true }).click(),
  ]);
  const path = await download.path();
  return { name: download.suggestedFilename(), bytes: readFileSync(path) };
}

/** Selects the bar at the bottom of page 1 and a jump back to the first bar; waits for both markers (organization mode). */
export async function addJumpToStart(page: Page): Promise<void> {
  const bars = page.getByTestId('org-bar');
  const chip = page.getByTestId('selection-chip');
  await bars.nth(PAGE1_BOTTOM_BAR_INDEX).click();
  await chip.getByTestId('chip-jump').click();
  await bars.nth(FIRST_BAR_INDEX).click();
  await expect(page.getByTestId('jump-marker')).toHaveCount(JUMP_MARKERS);
}

export async function enterAnnotation(page: Page): Promise<void> {
  await expect(async () => {
    await page.getByLabel(label('modeAnnotation'), { exact: true }).click();
    await expect(page.getByTestId('slide-canvas')).toBeVisible({ timeout: RETRY_TIMEOUT_MS });
  }).toPass();
}

export { enterOrganization };

export const tool = (page: Page, key: 'pen' | 'eraser') => page.getByRole('button', { name: label(key), exact: true });

export async function slideBox(page: Page) {
  const box = await page.getByTestId('slide-canvas').boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: STROKE_STEPS });
  await page.mouse.up();
}

/** A horizontal line on the slide, at a quarter of its height. */
export async function strokeLine(page: Page, from = STROKE_FROM, to = STROKE_TO) {
  const slide = await slideBox(page);
  const y = slide.y + slide.height * SLIDE_INK_ROW;
  return { from: { x: slide.x + slide.width * from, y }, to: { x: slide.x + slide.width * to, y } };
}

/** Reddish pixels of the whole slide (every layer): pdf.js drawing the annotation too would leave some after an erase. */
export async function redPixelsOnSlide(page: Page): Promise<number> {
  const slide = await slideBox(page);
  const png = await page.screenshot({
    clip: { x: Math.floor(slide.x), y: Math.floor(slide.y), width: Math.floor(slide.width), height: Math.floor(slide.height) },
    scale: 'css',
  });
  return page.evaluate(
    async ({ base64, stride, strong, weak }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += stride) {
        if (data[i]! >= strong && data[i + 1]! <= weak && data[i + 2]! <= weak) {
          count++;
        }
      }
      return count;
    },
    { base64: png.toString('base64'), stride: RGBA, strong: RED_MIN, weak: RED_MAX_OTHER },
  );
}

/** What the file holds, read in the Node test process with the same writer the app uses. */
export async function inspect(bytes: Uint8Array) {
  const ink = await api.listInk(bytes);
  const json = await api.readEmbeddedJson(bytes, KEY);
  return {
    ink: ink.ok ? ink.value : null,
    metadata: json.ok && json.value !== null ? parseMetadata(json.value) : null,
    json: json.ok ? json.value : null,
  };
}

/** SAV-006: every saved copy has to be structurally sound; skipped where qpdf is not installed (CI installs it). */
export function qpdfCheck(bytes: Uint8Array): void {
  if (spawnSync('qpdf', ['--version']).status !== 0) {
    return;
  }
  const path = join(TMP, `copy-${++fileSeq}.pdf`);
  writeFileSync(path, bytes);
  const result = spawnSync('qpdf', ['--check', path], { encoding: 'utf8' });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}

/** SAV-005: the first pages of the score with the metadata of the whole score copied in, so the page counts differ. */
export async function shorterPdfWithMetadata(json: string, pages = COPIES): Promise<Uint8Array> {
  const source = await PDFDocument.load(scoreBytes);
  const doc = await PDFDocument.create();
  for (const page of await doc.copyPages(source, Array.from({ length: pages }, (_, i) => i))) {
    doc.addPage(page);
  }
  await doc.attach(new TextEncoder().encode(json), KEY, { mimeType: TUNABLES.pdfWriter.embeddedFileMime });
  return doc.save({ useObjectStreams: false });
}
