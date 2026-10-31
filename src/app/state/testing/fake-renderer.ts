import { vi } from 'vitest';

import type { PdfDocumentHandle, PdfOpenError, PdfRenderError, PdfRenderer, RenderRequest } from '../../ports/pdf-renderer';
import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import { fakeBitmap } from './fake-bitmap';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;

export interface FakeHandle extends PdfDocumentHandle {
  renderRegion: ReturnType<typeof vi.fn<(req: RenderRequest, signal: AbortSignal) => Promise<Result<ImageBitmap, PdfRenderError>>>>;
  destroy: ReturnType<typeof vi.fn<() => Promise<void>>>;
}

export function fakeHandle(pageCount = 2): FakeHandle {
  return {
    pageCount,
    getPageInfo: (pageIndex) =>
      Promise.resolve(
        ok({ pageIndex, box: { view: [0, 0, PAGE_WIDTH, PAGE_HEIGHT], rotate: 0 }, width: PAGE_WIDTH, height: PAGE_HEIGHT }),
      ),
    renderRegion: vi.fn(() => Promise.resolve(ok(fakeBitmap()))),
    destroy: vi.fn(() => Promise.resolve()),
  } as FakeHandle;
}

/** Opens any bytes as a document; bytes whose first byte is 0 fail with `failWith`. */
export function fakeRenderer(failWith: PdfOpenError = 'invalid', pageCount = 2): PdfRenderer & { handles: FakeHandle[] } {
  const handles: FakeHandle[] = [];
  return {
    handles,
    open: (bytes) => {
      if (bytes[0] === 0) {
        return Promise.resolve(err(failWith));
      }
      const handle = fakeHandle(pageCount);
      handles.push(handle);
      return Promise.resolve(ok(handle));
    },
  };
}
