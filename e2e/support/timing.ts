/**
 * Shared timeouts of the end-to-end tests. CI runners are small and shared, and OpenCV / pdf.js are CPU-bound, so every
 * wait that depends on detection or rendering gets a factor there. Playwright's own defaults live in playwright.config.ts.
 */
const CI_TIMEOUT_FACTOR = 3;
const CI_FACTOR = process.env['CI'] ? CI_TIMEOUT_FACTOR : 1;
const DETECTION_BASE_MS = 45_000;
const RERUN_BASE_MS = 60_000;
const NEGATIVE_SETTLE_BASE_MS = 300;
const SCROLL_BASE_MS = 5_000;

export const scaled = (ms: number): number => ms * CI_FACTOR;

/** All pages of the synthetic score detected (bars of the whole document present). */
export const DETECTION_TIMEOUT_MS = scaled(DETECTION_BASE_MS);
/** A re-run of the detection at another level (DET-015). */
export const RERUN_TIMEOUT_MS = scaled(RERUN_BASE_MS);
/** The file chooser opens right after the click; a long wait only hides a broken button. */
export const FILE_CHOOSER_TIMEOUT_MS = 15_000;
/** One attempt of the repeated mode click: the click can land before the app reacts (WebKit). */
export const RETRY_TIMEOUT_MS = 1_000;
/** Time given to something that must NOT happen (a second tab, a console message) before asserting its absence. */
export const NEGATIVE_SETTLE_MS = scaled(NEGATIVE_SETTLE_BASE_MS);
export const SCROLL_TIMEOUT_MS = scaled(SCROLL_BASE_MS);
