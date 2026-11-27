import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import { TUNABLES } from '../../src/config/tunables';
import type { SystemMarks } from '../../src/app/core/marks';
import { testMetadata } from '../../src/testing/cross-file-files';

// The geometry of `testMetadata`: two pages of 600 x 800 with three systems at x 50, width 500, height 150, 250 apart.
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const PAGES = 2;
const SYSTEMS_PER_PAGE = 3;
const LEFT = 50;
const TOP = 50;
const WIDTH = 500;
const HEIGHT = 150;
const PITCH = 250;
const STAFF_LINES = 5;
const STAFF_GAP = 12;
const STAFF_FROM_TOP = 60;
const FRAME_WIDTH = 1;
const TEXT_SIZE = 28;
const TEXT_INSET = 12;
const TEXT_FROM_TOP = 34;

const TMP = mkdtempSync(join(tmpdir(), 'e2e-cross-file-'));

/**
 * A small score whose detection results and marks are already embedded, so opening it needs no detection. Every system is
 * framed and says which file, page and line it is, so a slide shows where the player is. The app cannot create cross-file
 * marks before V2-M10, so files that have them are built here.
 */
export async function crossFilePdf(title: string, marks: Partial<SystemMarks> = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let page = 0; page < PAGES; page++) {
    const sheet = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    for (let system = 0; system < SYSTEMS_PER_PAGE; system++) {
      const top = PAGE_HEIGHT - TOP - system * PITCH;
      sheet.drawRectangle({ x: LEFT, y: top - HEIGHT, width: WIDTH, height: HEIGHT, borderWidth: FRAME_WIDTH, borderColor: rgb(0, 0, 0) });
      for (let line = 0; line < STAFF_LINES; line++) {
        const y = top - STAFF_FROM_TOP - line * STAFF_GAP;
        sheet.drawLine({ start: { x: LEFT, y }, end: { x: LEFT + WIDTH, y }, thickness: FRAME_WIDTH });
      }
      sheet.drawText(`${title} - page ${page + 1}, line ${system + 1}`, { x: LEFT + TEXT_INSET, y: top - TEXT_FROM_TOP, size: TEXT_SIZE, font });
    }
  }
  await doc.attach(new TextEncoder().encode(testMetadata(marks)), TUNABLES.saving.metadataFileName, {
    mimeType: TUNABLES.pdfWriter.embeddedFileMime,
  });
  return doc.save({ useObjectStreams: false });
}

/** The bytes as a file on disk: choosing the same path twice gives the browser the same file (FIL-002). */
export function onDisk(name: string, bytes: Uint8Array): string {
  const directory = mkdtempSync(join(TMP, 'file-'));
  const path = join(directory, name);
  writeFileSync(path, bytes);
  return path;
}
