import { CapBackButton } from './cap-back-button';
import type { BackButtonApp } from './cap-back-button';

function fakeApp() {
  let listener: (() => void) | null = null;
  const app: BackButtonApp & { press(): void; minimized: number } = {
    minimized: 0,
    addListener: (_event, fn) => { listener = fn; return undefined; },
    minimizeApp: () => { app.minimized++; return Promise.resolve(); },
    press: () => listener?.(),
  };
  return app;
}

describe('CapBackButton', () => {
  it('PLT-007 runs handlers from the highest priority and stops at the first that handles it', () => {
    const app = fakeApp();
    const back = new CapBackButton(app);
    const calls: string[] = [];
    back.register(0, () => { calls.push('low'); return true; });
    back.register(10, () => { calls.push('high'); return false; });
    back.register(5, () => { calls.push('mid'); return true; });
    app.press();
    expect(calls).toEqual(['high', 'mid']);
    expect(app.minimized).toBe(0);
  });

  it('PLT-007 minimizes the app when no handler handles the event', () => {
    const app = fakeApp();
    const back = new CapBackButton(app);
    back.register(0, () => false);
    app.press();
    expect(app.minimized).toBe(1);
  });

  it('PLT-007 minimizes the app without any handler, and an unregistered handler is not called', () => {
    const app = fakeApp();
    const back = new CapBackButton(app);
    let called = 0;
    const unregister = back.register(0, () => { called++; return true; });
    unregister();
    app.press();
    expect(called).toBe(0);
    expect(app.minimized).toBe(1);
  });
});
