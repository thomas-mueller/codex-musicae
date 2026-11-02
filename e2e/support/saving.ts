import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, type Page } from '@playwright/test';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';

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
/** The default highlighter color as RGB. */
export const YELLOW: readonly number[] = hexRgb(TUNABLES.annotation.defaultHighlighter.color);
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

export const tool = (page: Page, key: 'pen' | 'highlighter' | 'eraser') => page.getByRole('button', { name: label(key), exact: true });

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

/** A horizontal line on the slide, by default at a quarter of its height (`row` is the fraction from the top). */
export async function strokeLine(page: Page, from = STROKE_FROM, to = STROKE_TO, row = SLIDE_INK_ROW) {
  const slide = await slideBox(page);
  const y = slide.y + slide.height * row;
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

// A foreign ink annotation (another app's: no /NM) on page 1 of the score: a horizontal line over the first system.
const FOREIGN_PAGE_HEIGHT = 842;
const FOREIGN_INK_FROM_TOP = 130;
const FOREIGN_INK_Y = FOREIGN_PAGE_HEIGHT - FOREIGN_INK_FROM_TOP;
const FOREIGN_INK_X0 = 100;
const FOREIGN_INK_X1 = 400;
const FOREIGN_INK_WIDTH = 3;
const FOREIGN_RECT_PAD = 5;
const FOREIGN_NOTE_ORIGIN = 5;
const FOREIGN_NOTE_SIZE = 20;
const FOREIGN_NOTE_RECT = [FOREIGN_NOTE_ORIGIN, FOREIGN_NOTE_ORIGIN, FOREIGN_NOTE_ORIGIN + FOREIGN_NOTE_SIZE, FOREIGN_NOTE_ORIGIN + FOREIGN_NOTE_SIZE];
export const FOREIGN_ATTACHMENT = 'foreign.txt';
export const FOREIGN_ATTACHMENT_TEXT = 'foreign';
/** Where the foreign line lies on page 1, in fractions of the system's x range (50..545 pt): used to aim the eraser. */
export const FOREIGN_INK_MIDDLE_X_PT = (FOREIGN_INK_X0 + FOREIGN_INK_X1) / 2;

/** The synthetic score with a foreign ink annotation, a foreign text annotation and a foreign attachment (SAV-013). */
export async function foreignScoreBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.load(scoreBytes);
  const { context } = doc;
  const foreignInk = context.register(
    context.obj({
      Type: 'Annot',
      Subtype: 'Ink',
      Rect: [FOREIGN_INK_X0 - FOREIGN_RECT_PAD, FOREIGN_INK_Y - FOREIGN_RECT_PAD, FOREIGN_INK_X1 + FOREIGN_RECT_PAD, FOREIGN_INK_Y + FOREIGN_RECT_PAD],
      InkList: [[FOREIGN_INK_X0, FOREIGN_INK_Y, FOREIGN_INK_MIDDLE_X_PT, FOREIGN_INK_Y, FOREIGN_INK_X1, FOREIGN_INK_Y]],
      C: [0, 0, 1],
      Border: [0, 0, FOREIGN_INK_WIDTH],
    }),
  );
  const note = context.register(context.obj({ Type: 'Annot', Subtype: 'Text', Rect: FOREIGN_NOTE_RECT, Contents: PDFString.of('note') }));
  doc.getPages()[0]!.node.set(PDFName.of('Annots'), context.obj([foreignInk, note]));
  await doc.attach(new TextEncoder().encode(FOREIGN_ATTACHMENT_TEXT), FOREIGN_ATTACHMENT, { mimeType: 'text/plain' });
  return doc.save({ useObjectStreams: false });
}

const COORDINATES_PER_POINT = 2;

/** Raw file facts read with pdf-lib only (not the app's reader): the number of points of every /Ink annotation, and the other subtypes. */
export async function annotationFacts(bytes: Uint8Array): Promise<{ inkPoints: number[]; otherSubtypes: string[] }> {
  const doc = await PDFDocument.load(bytes);
  const inkPoints: number[] = [];
  const otherSubtypes: string[] = [];
  for (const page of doc.getPages()) {
    const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    for (let i = 0; annots && i < annots.size(); i++) {
      const annot = annots.lookup(i, PDFDict);
      const subtype = annot.lookup(PDFName.of('Subtype'))?.toString() ?? '';
      if (subtype === '/Ink') {
        const lists = annot.lookup(PDFName.of('InkList'), PDFArray);
        let coordinates = 0;
        for (let l = 0; l < lists.size(); l++) {
          coordinates += lists.lookup(l, PDFArray).size();
        }
        inkPoints.push(coordinates / COORDINATES_PER_POINT);
      } else {
        otherSubtypes.push(subtype);
      }
    }
  }
  return { inkPoints, otherSubtypes };
}

/** Text of an attachment by name. */
export async function attachmentText(bytes: Uint8Array, name: string): Promise<string | null> {
  const text = await api.readEmbeddedJson(bytes, name);
  return text.ok ? text.value : null;
}

const ALPHA_OFFSET = 3;

/** The bounding box, in page (CSS) pixels, of the canvas pixels near `rgb`; null when there are none. */
export async function inkBounds(page: Page, testId: string, rgb: readonly number[], tolerance: number): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const canvas = page.getByTestId(testId);
  const box = await canvas.boundingBox();
  if (box === null) {
    return null;
  }
  const found = await canvas.evaluate(
    (element: HTMLCanvasElement, { color, delta, stride, alpha }: { color: number[]; delta: number; stride: number; alpha: number }) => {
      const context = element.getContext('2d');
      if (!context) {
        return null;
      }
      const { data } = context.getImageData(0, 0, element.width, element.height);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -1;
      let maxY = -1;
      for (let i = 0; i < data.length; i += stride) {
        if (data[i + alpha]! > 0 && color.every((v, k) => Math.abs(data[i + k]! - v) <= delta)) {
          const px = (i / stride) % element.width;
          const py = Math.floor(i / stride / element.width);
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
        }
      }
      return maxX < 0 ? null : { minX, minY, maxX, maxY, width: element.width, height: element.height };
    },
    { color: [...rgb], delta: tolerance, stride: RGBA, alpha: ALPHA_OFFSET },
  );
  if (found === null) {
    return null;
  }
  const scaleX = box.width / found.width;
  const scaleY = box.height / found.height;
  return { x: box.x + found.minX * scaleX, y: box.y + found.minY * scaleY, width: (found.maxX - found.minX) * scaleX, height: (found.maxY - found.minY) * scaleY };
}
