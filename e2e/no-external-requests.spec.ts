import { expect, test } from '@playwright/test';

import { desktopTest } from './support/desktop';
import { inkedPixelsNear } from './support/pixels';
import { foreignRequests, recordRequests } from './support/requests';
import { openScore, waitForBars, waitForFinalSlideCount } from './support/score';
import { COLOR_TOLERANCE, drag, enterAnnotation, enterOrganization, forceFilePaths, inspect, qpdfCheck, RED, saveCopyDownload, strokeLine, tool } from './support/saving';
import { PAID_URL } from './support/editions';
// V2-M3 S2: these specs need saving, restoring or persisted settings, which the free build switches off.
test.use({ baseURL: PAID_URL });

// The production build (the default base URL) makes no request that leaves the app's own origin (NFR-017, NFR-018, R-8d): the whole
// working flow is recorded, not just the start page.
desktopTest('NFR-017 NFR-018 open, detect, switch modes, draw and save as a new file: no request leaves the app origin', async ({ page }) => {
  await forceFilePaths(page);
  const requests = recordRequests(page);
  await page.goto('/');
  const appOrigin = new URL(page.url()).origin;

  await openScore(page);
  await enterOrganization(page);
  await waitForBars(page);
  await enterAnnotation(page);
  await waitForFinalSlideCount(page);

  await tool(page, 'pen').click();
  await expect(tool(page, 'pen')).toHaveAttribute('aria-pressed', 'true');
  const line = await strokeLine(page);
  await drag(page, line.from, line.to);
  await expect.poll(() => inkedPixelsNear(page.getByTestId('ink-canvas'), RED, COLOR_TOLERANCE)).toBeGreaterThan(0);

  const copy = await saveCopyDownload(page);
  qpdfCheck(copy.bytes);
  expect((await inspect(copy.bytes)).ink).toHaveLength(1);

  const all = requests.urls();
  expect(all.length, 'the recorder saw the app load').toBeGreaterThan(0);
  expect(foreignRequests(all, appOrigin), 'requests to foreign origins').toEqual([]);
});

// The failing example: the recorder does report a foreign request (and ignores data: and blob:), so a green run above means something.
desktopTest('NFR-018 the recorder reports a request to a foreign host and ignores data and blob URLs', async ({ page }) => {
  const foreign = 'https://example.invalid/resource.js';
  await page.route('https://example.invalid/**', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const requests = recordRequests(page);
  await page.goto('/');
  const appOrigin = new URL(page.url()).origin;
  await page.evaluate(async (url) => {
    await globalThis.fetch(url);
    await globalThis.fetch('data:text/plain,ok');
    await globalThis.fetch(globalThis.URL.createObjectURL(new globalThis.Blob(['ok'])));
  }, foreign);
  expect(foreignRequests(requests.urls(), appOrigin)).toEqual([foreign]);
});
