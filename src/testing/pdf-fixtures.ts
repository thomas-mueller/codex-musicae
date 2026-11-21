import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from 'vitest';

/** Node-only helpers for specs that produce PDFs. */
export const HAS_QPDF = spawnSync('qpdf', ['--version']).status === 0;
const TMP = mkdtempSync(join(tmpdir(), 'pdf-spec-'));
let fileSeq = 0;

/** A failure-case fixture of e2e/fixtures/ or a real PDF of the corpus (e2e/corpus/real/), by file name. */
export function fixture(file: string): Uint8Array {
  const folder = existsSync(`e2e/fixtures/${file}`) ? 'e2e/fixtures' : 'e2e/corpus/real';
  return new Uint8Array(readFileSync(`${folder}/${file}`));
}

/** Every produced file must be structurally sound; where qpdf is not installed the check is skipped (CI installs it). */
export function qpdfCheck(bytes: Uint8Array): void {
  if (!HAS_QPDF) {
    return;
  }
  const path = join(TMP, `out-${++fileSeq}.pdf`);
  writeFileSync(path, bytes);
  const result = spawnSync('qpdf', ['--check', path], { encoding: 'utf8' });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}
