import { expect, type Page } from '@playwright/test';

import { FILE_CHOOSER_TIMEOUT_MS, RERUN_TIMEOUT_MS } from './timing';
import { label } from './score';

export type CorpusLevel = 'fast' | 'standard' | 'fine';
export const CORPUS_LEVELS: readonly CorpusLevel[] = ['fast', 'standard', 'fine'];

type CorpusHook = {
  systemCounts: () => { level: string; counts: (number | null)[] };
  detectionState: () => { complete: boolean };
  redetect: (level: string) => void;
};

/** Opens `bytes` through the file input (the caller ran `forceFileInput` and `goto`). */
export async function openPdfBytes(page: Page, name: string, bytes: Buffer): Promise<void> {
  const chooser = page.waitForEvent('filechooser', { timeout: FILE_CHOOSER_TIMEOUT_MS });
  await page.getByRole('button', { name: label('openFile'), exact: true }).click();
  await (await chooser).setFiles({ name, mimeType: 'application/pdf', buffer: bytes });
}

/** Waits until detection of the active document is complete at `level` and returns the system count per page. */
export async function systemCountsAt(
  page: Page,
  level: CorpusLevel,
  rerun: boolean,
): Promise<(number | null)[]> {
  if (rerun) {
    await page.evaluate(
      (l) => (globalThis as unknown as { __cm: CorpusHook }).__cm.redetect(l),
      level,
    );
  }
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const hook = (globalThis as unknown as { __cm: CorpusHook }).__cm;
          const { level, counts } = hook.systemCounts();
          // A document that is still opening has no pages yet and counts as complete; a failed page stays null.
          return { level, complete: hook.detectionState().complete && counts.length > 0 && counts.every((c) => c !== null) };
        }),
      { timeout: RERUN_TIMEOUT_MS },
    )
    .toEqual({ level, complete: true });
  return page.evaluate(
    () => (globalThis as unknown as { __cm: CorpusHook }).__cm.systemCounts().counts,
  );
}
