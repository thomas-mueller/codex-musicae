import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from 'vitest';

/** Node-only helpers for specs that produce PDFs. */
export const HAS_QPDF = spawnSync('qpdf', ['--version']).status === 0;
const TMP = mkdtempSync(join(tmpdir(), 'pdf-spec-'));
let fileSeq = 0;

export function fixture(file: string): Uint8Array {
  return new Uint8Array(readFileSync(`e2e/fixtures/${file}`));
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

/** An AES-256 encrypted copy of `bytes` (needs qpdf). */
export function encrypted(bytes: Uint8Array): Uint8Array {
  const input = join(TMP, `plain-${++fileSeq}.pdf`);
  const output = join(TMP, `encrypted-${fileSeq}.pdf`);
  writeFileSync(input, bytes);
  expect(spawnSync('qpdf', ['--encrypt', 'user', 'owner', '256', '--', input, output]).status).toBe(0);
  return new Uint8Array(readFileSync(output));
}
