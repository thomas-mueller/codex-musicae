import { DocumentStore } from './document.store';
import { fakeRenderer } from './testing/fake-renderer';

describe('DocumentStore', () => {
  it('FIL-005 starts loading and becomes ready with page infos', async () => {
    const renderer = fakeRenderer();
    const doc = new DocumentStore('t1', renderer);
    expect(doc.status()).toBe('loading');
    await doc.load(new Uint8Array([1]));
    expect(doc.status()).toBe('ready');
    expect(doc.pageInfos().map((p) => p.pageIndex)).toEqual([0, 1]);
    expect(doc.handle()).toBe(renderer.handles[0]);
  });

  for (const code of ['invalid', 'encrypted', 'empty'] as const) {
    it(`FIL-009 ${code} document ends in error state with its code`, async () => {
      const doc = new DocumentStore('t1', fakeRenderer(code));
      await doc.load(new Uint8Array([0]));
      expect(doc.status()).toBe('error');
      expect(doc.errorCode()).toBe(code);
      expect(doc.handle()).toBeNull();
    });
  }

  it('FIL-009 dispose destroys the handle once', async () => {
    const renderer = fakeRenderer();
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    await doc.dispose();
    await doc.dispose();
    expect(renderer.handles[0]?.destroy).toHaveBeenCalledTimes(1);
    expect(doc.handle()).toBeNull();
  });

  it('ORG-006 zoom and scroll default to fit-width at the top and are kept per document', () => {
    const a = new DocumentStore('a', fakeRenderer());
    const b = new DocumentStore('b', fakeRenderer());
    expect(a.orgZoom()).toBe(1);
    expect(a.orgScroll()).toEqual({ x: 0, y: 0 });
    a.orgZoom.set(2);
    a.orgScroll.set({ x: 5, y: 700 });
    expect(b.orgZoom()).toBe(1);
    expect(b.orgScroll()).toEqual({ x: 0, y: 0 });
    expect(a.orgScroll()).toEqual({ x: 5, y: 700 });
  });
});
