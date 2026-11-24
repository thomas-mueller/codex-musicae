import { describe, expect, it, vi } from 'vitest';

import { PdfJsRenderer } from './pdfjs-renderer';
import type { PdfjsDocument, PdfjsModule, PdfjsPage } from './pdfjs-renderer';

const REGION = { x: 0, y: 0, width: 100, height: 50 };

function setup() {
  const order: string[] = [];
  const page: PdfjsPage = {
    view: [0, 0, 595, 842],
    rotate: 0,
    getViewport: vi.fn((o: { scale: number }) => ({ width: 595 * o.scale, height: 842 * o.scale })),
    render: vi.fn(() => {
      order.push('render');
      return { promise: Promise.resolve(), cancel: vi.fn() };
    }),
    cleanup: vi.fn(() => order.push('cleanup')),
  };
  const doc: PdfjsDocument = { numPages: 1, getPage: vi.fn(() => Promise.resolve(page)), destroy: vi.fn(() => Promise.resolve()) };
  const module: PdfjsModule = { GlobalWorkerOptions: { workerSrc: '' }, getDocument: vi.fn(() => ({ promise: Promise.resolve(doc), destroy: vi.fn(() => Promise.resolve()) })) };
  const renderer = new PdfJsRenderer({
    loadModule: () => Promise.resolve(module),
    createCanvas: (width, height) => ({ width, height, getContext: () => ({}) }),
    createBitmap: () => Promise.resolve({ close: vi.fn() } as unknown as ImageBitmap),
    baseUri: 'http://localhost/app/',
    warmPages: 2,
  });
  return { renderer, page, order };
}

describe('PdfJsRenderer fresh renders (NFR-028)', () => {
  it('NFR-028 a fresh render drops the pdf.js state of the page before it renders, a normal one does not', async () => {
    const { renderer, page, order } = setup();
    const opened = await renderer.open(new Uint8Array([1]));
    if (!opened.ok) {
      throw new Error('open failed');
    }
    const never = new AbortController().signal;
    await opened.value.renderRegion({ pageIndex: 0, region: REGION, scale: 1 }, never);
    expect(page.cleanup).not.toHaveBeenCalled(); // the page stays warm
    await opened.value.renderRegion({ pageIndex: 0, region: REGION, scale: 1, fresh: true }, never);
    expect(order).toEqual(['render', 'cleanup', 'render']);
  });
});
