import { expect, test } from '@playwright/test';

import { inspect, forceFilePaths, openPdf, qpdfCheck, saveCopyDownload } from './support/saving';
import { openScore, waitForFinalSlideCount } from './support/score';
import { TUNABLES } from '../src/config/tunables';

import type { InkStroke } from '../src/app/core/annotation';
import type { DebugStrokeOp } from '../src/app/adapters/web/debug-hook';

const DEV_URL = 'http://127.0.0.1:4174';
const TEST_TIMEOUT_MS = 300_000;
const SEED = 0x7a3c91;
const SEQUENCES = 20;
const OPS_MIN = 8;
const OPS_SPAN = 8;
const POINTS_MIN = 2;
const POINTS_SPAN = 5;
const PAGE_COUNT = 3; // synthetic-score.pdf
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const WIDTH_MAX_PT = 10;
const POINT_TOLERANCE = 1e-3;
const OPACITIES = [1, TUNABLES.annotation.highlighterOpacity];
// Operation mix: add, erase, undo, redo (weights).
const WEIGHT_ADD = 5;
const WEIGHT_ERASE = 3;
const WEIGHT_UNDO = 3;
const WEIGHT_REDO = 2;

type Hook = { strokes: () => InkStroke[]; applyOps: (ops: DebugStrokeOp[]) => void };
const hook = <T>(page: import('@playwright/test').Page, fn: (cm: Hook, arg: never) => T, arg?: unknown) =>
  page.evaluate(([source, a]) => (new Function(`return (${source})`)() as (cm: Hook, a: unknown) => T)((globalThis as unknown as { __cm: Hook }).__cm, a), [fn.toString(), arg] as const);

/** mulberry32: a fixed seed gives the same sequences on every run. */
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function makeSequence(random: () => number, sequence: number): DebugStrokeOp[] {
  const pick = (n: number): number => Math.floor(random() * n);
  const ids: string[] = [];
  const ops: DebugStrokeOp[] = [];
  const total = WEIGHT_ADD + WEIGHT_ERASE + WEIGHT_UNDO + WEIGHT_REDO;
  const count = OPS_MIN + pick(OPS_SPAN);
  for (let n = 0; n < count; n++) {
    const roll = pick(total);
    if (roll < WEIGHT_ADD || ids.length === 0) {
      const id = `prop-${sequence}-${n}`;
      ids.push(id);
      const points = Array.from({ length: POINTS_MIN + pick(POINTS_SPAN) }, () => ({
        x: Number((random() * PAGE_WIDTH).toFixed(2)),
        y: Number((random() * PAGE_HEIGHT).toFixed(2)),
      }));
      const multiply = random() < 0.5;
      ops.push({
        op: 'add',
        stroke: {
          id,
          pageIndex: pick(PAGE_COUNT),
          points,
          color: TUNABLES.colors.penPresets[pick(TUNABLES.colors.penPresets.length)]!,
          widthPt: 1 + pick(WIDTH_MAX_PT),
          opacity: multiply ? OPACITIES[1]! : OPACITIES[0]!,
          multiply,
        },
      });
    } else if (roll < WEIGHT_ADD + WEIGHT_ERASE) {
      ops.push({ op: 'erase', id: ids[pick(ids.length)]! });
    } else if (roll < WEIGHT_ADD + WEIGHT_ERASE + WEIGHT_UNDO) {
      ops.push({ op: 'undo' });
    } else {
      ops.push({ op: 'redo' });
    }
  }
  return ops;
}

test.setTimeout(TEST_TIMEOUT_MS);
test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'dev build with the debug hook: desktop Chromium');
});

test('TST-003 SAV-006 SAV-007 ANN-005 ANN-006 random add, erase, undo and redo sequences survive a save and reopen unchanged', async ({ page }) => {
  // One copy with the detection inside serves as the document of every sequence (opening it runs no detection).
  await forceFilePaths(page);
  await page.goto(DEV_URL);
  await openScore(page);
  await waitForFinalSlideCount(page);
  const base = await saveCopyDownload(page);

  const random = makeRandom(SEED);
  let compared = 0;
  for (let sequence = 0; sequence < SEQUENCES; sequence++) {
    await page.goto(DEV_URL);
    await openPdf(page, base.bytes, base.name);
    await waitForFinalSlideCount(page);
    await hook(page, (cm, ops) => cm.applyOps(ops as DebugStrokeOp[]), makeSequence(random, sequence));
    const expected = await hook(page, (cm) => cm.strokes());

    const copy = await saveCopyDownload(page);
    qpdfCheck(copy.bytes);
    const saved = (await inspect(copy.bytes)).ink ?? [];
    expect(saved.map((i) => i.strokeId).sort(), `sequence ${sequence}`).toEqual(expected.map((s) => s.id).sort());
    compared += expected.length;
    for (const stroke of expected) {
      const file = saved.find((i) => i.strokeId === stroke.id)!;
      expect(file.pageIndex).toBe(stroke.pageIndex);
      expect(file.points).toHaveLength(stroke.points.length);
      stroke.points.forEach((p, k) => {
        expect(Math.abs(file.points[k]!.x - p.x)).toBeLessThan(POINT_TOLERANCE);
        expect(Math.abs(file.points[k]!.y - p.y)).toBeLessThan(POINT_TOLERANCE);
      });
      expect(file.color.toLowerCase()).toBe(stroke.color.toLowerCase());
    }

    // Reopening the copy gives the same strokes back.
    await page.goto(DEV_URL);
    await openPdf(page, copy.bytes, copy.name);
    await expect.poll(async () => (await hook(page, (cm) => cm.strokes())).length).toBe(expected.length);
    const reopened = await hook(page, (cm) => cm.strokes());
    expect(reopened.map((s) => s.id).sort()).toEqual(expected.map((s) => s.id).sort());
  }
  expect(compared, 'the sequences leave strokes to compare').toBeGreaterThan(0);
});
