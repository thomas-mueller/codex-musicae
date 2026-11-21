import type { Page, Request } from '@playwright/test';

/** Schemes that never leave the browser. */
const LOCAL_SCHEMES = new Set(['data:', 'blob:', 'about:']);
const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

/**
 * The requests among `urls` that go to another origin than `appOrigin`. `data:` and `blob:` URLs stay inside the browser; any other
 * scheme (`ftp:`, `chrome-extension:` ...) or an unparsable URL counts as foreign, so nothing slips through by an unusual form.
 */
export function foreignRequests(urls: readonly string[], appOrigin: string): string[] {
  return urls.filter((url) => {
    try {
      const parsed = new URL(url);
      if (LOCAL_SCHEMES.has(parsed.protocol)) {
        return false;
      }
      return !NETWORK_SCHEMES.has(parsed.protocol) || parsed.origin !== appOrigin;
    } catch {
      return true;
    }
  });
}

/**
 * Records the URL of every request of the page and of its context (workers and the service worker are reported by the context in
 * Chromium, not by the page). Call before `page.goto`.
 */
export function recordRequests(page: Page): { urls: () => string[] } {
  const seen = new Set<Request>();
  const urls: string[] = [];
  const record = (request: Request): void => {
    if (!seen.has(request)) {
      seen.add(request);
      urls.push(request.url());
    }
  };
  page.on('request', record);
  page.context().on('request', record);
  return { urls: () => [...urls] };
}
