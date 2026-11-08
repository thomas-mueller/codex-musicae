import { WebFullscreen } from './web-fullscreen';

function fakeDoc(options: { standard?: boolean; prefixed?: boolean; reject?: boolean; rejectOptions?: boolean; silent?: boolean } = {}) {
  const doc = Object.assign(new EventTarget(), {
    fullscreenElement: null as Element | null,
    webkitFullscreenElement: null as Element | null,
    calls: [] as unknown[],
    documentElement: {} as Record<string, unknown>,
    exitFullscreen: () => {
      doc.fullscreenElement = null;
      if (!options.silent) doc.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    },
  });
  const enterFn = (...args: unknown[]) => {
    doc.calls.push(args);
    if (options.reject) return Promise.reject(new Error('no'));
    if (options.rejectOptions && args.length > 0) return Promise.reject(new TypeError('options'));
    doc.fullscreenElement = {} as Element;
    if (!options.silent) doc.dispatchEvent(new Event('fullscreenchange'));
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

  it('PLT-016 retries without options when the dictionary form is rejected', async () => {
    const doc = fakeDoc({ rejectOptions: true });
    expect((await new WebFullscreen(doc).enter()).ok).toBe(true);
    expect(doc.calls).toEqual([[{ navigationUI: 'hide' }], []]);
  });

  it('PLT-016 exposes the failure reason as lastError', async () => {
    const fullscreen = new WebFullscreen(fakeDoc({ reject: true }));
    expect(await fullscreen.enter()).toEqual({ ok: false, error: 'denied' });
    expect(fullscreen.lastError()).toBe('Error: no');
  });

  it('PLT-016 exits and reports active without waiting for the change event', async () => {
    const doc = fakeDoc({ silent: true });
    const fullscreen = new WebFullscreen(doc);
    await fullscreen.enter();
    expect(fullscreen.active()).toBe(true);
    await fullscreen.exit();
    expect(doc.fullscreenElement).toBeNull();
    expect(fullscreen.active()).toBe(false);
  });

  it('PLT-016 an Esc after an own exit without events is still reported as external', async () => {
    const doc = fakeDoc({ silent: true });
    const fullscreen = new WebFullscreen(doc);
    let external = 0;
    fullscreen.onExternalExit(() => external++);
    await fullscreen.enter();
    await fullscreen.exit();
    await fullscreen.enter();
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event('fullscreenchange'));
    expect(external).toBe(1);
  });
});
