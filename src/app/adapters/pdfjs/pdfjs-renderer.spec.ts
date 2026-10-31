import { describe, expect, it, vi } from 'vitest';

import { TUNABLES } from '../../../config/tunables';
import { PdfJsRenderer } from './pdfjs-renderer';
import type { PdfjsDocument, PdfjsModule, PdfjsPage } from './pdfjs-renderer';

class NamedError extends Error {
  constructor(name: string) {
    super(name);
    this.name = name;
  }
}

interface FakeCanvas {
  width: number;
  height: number;
  getContext(kind: '2d'): object | null;
}

function fakePage(overrides: Partial<PdfjsPage> = {}): PdfjsPage {
  return {
    view: [0, 0, 595, 842],
    rotate: 0,
    getViewport: vi.fn((o: { scale: number }) => ({ width: 595 * o.scale, height: 842 * o.scale })),
    render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
    cleanup: vi.fn(),
    ...overrides,
  };
}

function fakeDocument(page: PdfjsPage, numPages = 1): PdfjsDocument {
  return { numPages, getPage: vi.fn(() => Promise.resolve(page)), destroy: vi.fn(() => Promise.resolve()) };
}

function fakeModule(open: () => Promise<PdfjsDocument>): PdfjsModule {
  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(() => ({ promise: open(), destroy: vi.fn(() => Promise.resolve()) })),
  };
}

function makeRenderer(module: PdfjsModule, canvases: FakeCanvas[] = []) {
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const renderer = new PdfJsRenderer({
    loadModule: () => Promise.resolve(module),
    createCanvas: (width, height) => {
      const canvas: FakeCanvas = { width, height, getContext: () => ({}) };
      canvases.push(canvas);
      return canvas;
    },
    createBitmap: () => Promise.resolve(bitmap),
    baseUri: 'http://localhost/app/',
  });
  return { renderer, bitmap };
}

const region = { x: 10, y: 20, width: 100, height: 50 };

describe('PdfJsRenderer.open', () => {
  it('FIL-009 maps a password error to encrypted', async () => {
    const { renderer } = makeRenderer(fakeModule(() => Promise.reject(new NamedError('PasswordException'))));
    expect(await renderer.open(new Uint8Array([1]))).toMatchObject({ ok: false, error: 'encrypted' });
  });

  it('FIL-009 maps InvalidPDFException to invalid', async () => {
    const { renderer } = makeRenderer(fakeModule(() => Promise.reject(new NamedError('InvalidPDFException'))));
    expect(await renderer.open(new Uint8Array([1]))).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('FIL-009 maps other pdf.js failures to invalid', async () => {
    const { renderer } = makeRenderer(fakeModule(() => Promise.reject(new Error('boom'))));
    expect(await renderer.open(new Uint8Array([1]))).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('FIL-009 maps a document without pages to empty and destroys it', async () => {
    const doc = fakeDocument(fakePage(), 0);
    const { renderer } = makeRenderer(fakeModule(() => Promise.resolve(doc)));
    expect(await renderer.open(new Uint8Array([1]))).toMatchObject({ ok: false, error: 'empty' });
    expect(doc.destroy).toHaveBeenCalled();
  });

  it('FIL-009 never throws when the module cannot be loaded', async () => {
    const renderer = new PdfJsRenderer({ loadModule: () => Promise.reject(new Error('no module')) });
    expect(await renderer.open(new Uint8Array([1]))).toMatchObject({ ok: false, error: 'unknown' });
  });

  it('GEN-005 points the worker and data folders at local assets', async () => {
    const module = fakeModule(() => Promise.resolve(fakeDocument(fakePage())));
    const { renderer } = makeRenderer(module);
    await renderer.open(new Uint8Array([1]));
    expect(module.GlobalWorkerOptions.workerSrc).toBe(`http://localhost/app/${TUNABLES.pdf.workerSrc}`);
    expect(module.getDocument).toHaveBeenCalledWith(
      expect.objectContaining({ cMapUrl: `http://localhost/app/${TUNABLES.pdf.cMapUrl}` }),
    );
  });
});

describe('PdfJsRenderer handle', () => {
  async function openHandle(page: PdfjsPage, canvases: FakeCanvas[] = []) {
    const { renderer, bitmap } = makeRenderer(fakeModule(() => Promise.resolve(fakeDocument(page))), canvases);
    const opened = await renderer.open(new Uint8Array([1]));
    if (!opened.ok) {
      throw new Error('open failed');
    }
    return { handle: opened.value, bitmap };
  }

  it('FIL-009 reports the page count', async () => {
    const { handle } = await openHandle(fakePage());
    expect(handle.pageCount).toBe(1);
  });

  it('NFR-006 getPageInfo maps view, rotate and display size', async () => {
    const page = fakePage({
      rotate: 90,
      getViewport: vi.fn(() => ({ width: 842, height: 595 })),
    });
    const { handle } = await openHandle(page);
    const info = await handle.getPageInfo(0);
    expect(info).toEqual({
      ok: true,
      value: { pageIndex: 0, box: { view: [0, 0, 595, 842], rotate: 90 }, width: 842, height: 595 },
    });
  });

  it('NFR-006 getPageInfo returns unknown when the page cannot be loaded', async () => {
    const doc = fakeDocument(fakePage());
    doc.getPage = vi.fn(() => Promise.reject(new Error('bad page')));
    const { renderer } = makeRenderer(fakeModule(() => Promise.resolve(doc)));
    const opened = await renderer.open(new Uint8Array([1]));
    if (!opened.ok) {
      throw new Error('open failed');
    }
    expect(await opened.value.getPageInfo(5)).toMatchObject({ ok: false, error: 'unknown' });
  });

  it('NFR-005 renders the region with scale and offset and releases the canvas', async () => {
    const page = fakePage();
    const canvases: FakeCanvas[] = [];
    const { handle, bitmap } = await openHandle(page, canvases);
    const result = await handle.renderRegion({ pageIndex: 0, region, scale: 1.5 }, new AbortController().signal);
    expect(result).toEqual({ ok: true, value: bitmap });
    expect(page.getViewport).toHaveBeenCalledWith({ scale: 1.5, offsetX: -15, offsetY: -30 });
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
  });

  it('NFR-006 rejects a region above the canvas pixel cap before allocating', async () => {
    const canvases: FakeCanvas[] = [];
    const { handle } = await openHandle(fakePage(), canvases);
    const side = Math.ceil(Math.sqrt(TUNABLES.resources.maxCanvasPixels)) + 1;
    const result = await handle.renderRegion(
      { pageIndex: 0, region: { x: 0, y: 0, width: side, height: side }, scale: 1 },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, error: 'out-of-memory' });
    expect(canvases).toHaveLength(0);
  });

  it('NFR-008 returns cancelled for an already aborted signal without allocating', async () => {
    const canvases: FakeCanvas[] = [];
    const { handle } = await openHandle(fakePage(), canvases);
    const controller = new AbortController();
    controller.abort();
    const result = await handle.renderRegion({ pageIndex: 0, region, scale: 1 }, controller.signal);
    expect(result).toMatchObject({ ok: false, error: 'cancelled' });
    expect(canvases).toHaveLength(0);
  });

  it('NFR-008 cancels the render task when the signal aborts during rendering', async () => {
    let rejectRender: (e: Error) => void = () => undefined;
    const cancel = vi.fn(() => rejectRender(new NamedError('RenderingCancelledException')));
    const page = fakePage({
      render: vi.fn(() => ({
        promise: new Promise<void>((_resolve, reject) => {
          rejectRender = reject;
        }),
        cancel,
      })),
    });
    const canvases: FakeCanvas[] = [];
    const { handle, bitmap } = await openHandle(page, canvases);
    const controller = new AbortController();
    const pending = handle.renderRegion({ pageIndex: 0, region, scale: 1 }, controller.signal);
    await vi.waitFor(() => expect(page.render).toHaveBeenCalled());
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, error: 'cancelled' });
    expect(cancel).toHaveBeenCalled();
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
    expect(bitmap.close).not.toHaveBeenCalled();
  });

  it('NFR-006 maps an allocation failure to out-of-memory', async () => {
    const page = fakePage({
      render: vi.fn(() => ({ promise: Promise.reject(new RangeError('Array buffer allocation failed')), cancel: vi.fn() })),
    });
    const { handle } = await openHandle(page);
    const result = await handle.renderRegion({ pageIndex: 0, region, scale: 1 }, new AbortController().signal);
    expect(result).toMatchObject({ ok: false, error: 'out-of-memory' });
  });

  it('NFR-006 maps a missing 2d context to out-of-memory', async () => {
    const renderer = new PdfJsRenderer({
      loadModule: () => Promise.resolve(fakeModule(() => Promise.resolve(fakeDocument(fakePage())))),
      createCanvas: (width, height) => ({ width, height, getContext: () => null }),
      createBitmap: () => Promise.resolve({ close: vi.fn() } as unknown as ImageBitmap),
    });
    const opened = await renderer.open(new Uint8Array([1]));
    if (!opened.ok) {
      throw new Error('open failed');
    }
    const result = await opened.value.renderRegion({ pageIndex: 0, region, scale: 1 }, new AbortController().signal);
    expect(result).toMatchObject({ ok: false, error: 'out-of-memory' });
  });

  it('NFR-008 closes the bitmap when the signal aborts after rendering finished', async () => {
    const closeSpy = vi.fn();
    const controller = new AbortController();
    const renderer = new PdfJsRenderer({
      loadModule: () => Promise.resolve(fakeModule(() => Promise.resolve(fakeDocument(fakePage())))),
      createCanvas: (width, height) => ({ width, height, getContext: () => ({}) }),
      createBitmap: () => {
        controller.abort();
        return Promise.resolve({ close: closeSpy } as unknown as ImageBitmap);
      },
    });
    const opened = await renderer.open(new Uint8Array([1]));
    if (!opened.ok) {
      throw new Error('open failed');
    }
    const result = await opened.value.renderRegion({ pageIndex: 0, region, scale: 1 }, controller.signal);
    expect(result).toMatchObject({ ok: false, error: 'cancelled' });
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('FIL-009 destroy never throws', async () => {
    const doc = fakeDocument(fakePage());
    doc.destroy = vi.fn(() => Promise.reject(new Error('fail')));
    const { renderer } = makeRenderer(fakeModule(() => Promise.resolve(doc)));
    const opened = await renderer.open(new Uint8Array([1]));
    if (!opened.ok) {
      throw new Error('open failed');
    }
    await expect(opened.value.destroy()).resolves.toBeUndefined();
  });
});
