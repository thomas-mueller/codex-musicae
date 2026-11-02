import { WebFullscreen } from './web-fullscreen';

function fakeDoc(options: { standard?: boolean; prefixed?: boolean; reject?: boolean } = {}) {
  const doc = Object.assign(new EventTarget(), {
    fullscreenElement: null as Element | null,
    webkitFullscreenElement: null as Element | null,
    calls: [] as unknown[],
    documentElement: {} as Record<string, unknown>,
    exitFullscreen: () => {
      doc.fullscreenElement = null;
      doc.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    },
  });
  const enterFn = (...args: unknown[]) => {
    doc.calls.push(args);
    if (options.reject) return Promise.reject(new Error('no'));
    doc.fullscreenElement = {} as Element;
    doc.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  };
  if (options.standard !== false && !options.prefixed) doc.documentElement['requestFullscreen'] = enterFn;
  if (options.prefixed) doc.documentElement['webkitRequestFullscreen'] = enterFn;
  return doc;
}

describe('WebFullscreen', () => {
  it('PLT-004 enters with navigationUI hide and reports active', async () => {
    const doc = fakeDoc();
    const fullscreen = new WebFullscreen(doc);
    expect((await fullscreen.enter()).ok).toBe(true);
    expect(doc.calls).toEqual([[{ navigationUI: 'hide' }]]);
    expect(fullscreen.active()).toBe(true);
  });

  it('PLT-004 falls back to the webkit-prefixed method', async () => {
    const doc = fakeDoc({ prefixed: true });
    expect((await new WebFullscreen(doc).enter()).ok).toBe(true);
    expect(doc.calls.length).toBe(1);
  });

  it('PLT-004 returns unsupported without an API and denied on rejection', async () => {
    expect(await new WebFullscreen(fakeDoc({ standard: false })).enter()).toEqual({ ok: false, error: 'unsupported' });
    expect(await new WebFullscreen(fakeDoc({ reject: true })).enter()).toEqual({ ok: false, error: 'denied' });
  });

  it('PLT-004 reports an external exit but not one caused by exit()', async () => {
    const doc = fakeDoc();
    const fullscreen = new WebFullscreen(doc);
    let external = 0;
    fullscreen.onExternalExit(() => external++);

    await fullscreen.enter();
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
    expect(external).toBe(1);
    expect(fullscreen.active()).toBe(false);

    await fullscreen.enter();
    await fullscreen.exit();
    expect(external).toBe(1);
  });
});
