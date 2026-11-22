import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { DocumentStore } from '../../state/document.store';
import { fakeRenderer } from '../../state/testing/fake-renderer';
import { PageTiles } from './page-tiles';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
const SIZE = { width: 600, height: 800 };

describe('PageTiles', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    TestBed.configureTestingModule({ providers: [provideTestPorts()] });
  });
  afterEach(() => vi.restoreAllMocks());

  it('FIL-005 tiles of the previous document are replaced when another tab is selected', async () => {
    const renderer = fakeRenderer();
    const first = new DocumentStore('t1', renderer);
    const second = new DocumentStore('t2', renderer);
    await first.load(new Uint8Array([1]));
    await second.load(new Uint8Array([1]));
    const fixture = TestBed.createComponent(PageTiles);
    const rect = { x: 0, y: 0, width: SIZE.width, height: SIZE.height };
    fixture.componentRef.setInput('document', first);
    fixture.componentRef.setInput('pageIndex', 0);
    fixture.componentRef.setInput('pageSize', SIZE);
    fixture.componentRef.setInput('settledScale', 1);
    fixture.componentRef.setInput('liveScale', 1);
    fixture.componentRef.setInput('visibleRect', rect);
    fixture.componentRef.setInput('viewportRect', rect);
    await fixture.whenStable();
    await settle();
    expect(renderer.handles[0]?.renderRegion).toHaveBeenCalled();
    expect(renderer.handles[1]?.renderRegion).not.toHaveBeenCalled();

    fixture.componentRef.setInput('document', second);
    await fixture.whenStable();
    await settle();
    // same page, scale and rectangles: only the document differs, and its content must be rendered
    expect(renderer.handles[1]?.renderRegion).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('canvas')).toHaveLength(renderer.handles[1]?.renderRegion.mock.calls.length ?? -1);
  });

  it('NFR-008 a tile whose render failed is rendered again, not left blank', async () => {
    const renderer = fakeRenderer();
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    const handle = renderer.handles[0]!;
    const good = handle.renderRegion.getMockImplementation()!;
    handle.renderRegion.mockImplementationOnce(() => Promise.resolve({ ok: false, error: 'unknown' } as const));
    handle.renderRegion.mockImplementation(good);
    const fixture = TestBed.createComponent(PageTiles);
    const rect = { x: 0, y: 0, width: SIZE.width, height: SIZE.height };
    fixture.componentRef.setInput('document', doc);
    fixture.componentRef.setInput('pageIndex', 0);
    fixture.componentRef.setInput('pageSize', SIZE);
    fixture.componentRef.setInput('settledScale', 1);
    fixture.componentRef.setInput('liveScale', 1);
    fixture.componentRef.setInput('visibleRect', rect);
    fixture.componentRef.setInput('viewportRect', rect);
    await fixture.whenStable();
    await settle();
    await settle();
    const canvases: HTMLCanvasElement[] = Array.from(fixture.nativeElement.querySelectorAll('canvas'));
    expect(handle.renderRegion.mock.calls.length).toBeGreaterThan(canvases.length); // the failed call plus one call per tile
    expect(canvases.length).toBeGreaterThan(0);
    expect(canvases.every((c) => c.style.visibility === 'visible')).toBe(true);
  });
});
