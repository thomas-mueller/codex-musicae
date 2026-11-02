import { TUNABLES } from '../../config/tunables';
import type { Mode } from '../state/ui.store';
import { WheelInput } from './wheel-input';
import type { WheelContext, WheelLike } from './wheel-input';

const NOTCH = 100;
const QUICK_MS = 100;
const ANCHOR = { x: 120, y: 80 };

const wheel = (extra: Partial<WheelLike> = {}): WheelLike => ({ deltaX: 0, deltaY: NOTCH, deltaMode: 0, ctrlKey: false, shiftKey: false, t: 0, ...extra });
const ctx = (mode: Mode = 'annotation', zoomed = false): WheelContext => ({ mode, zoomed, anchor: ANCHOR });

describe('WheelInput', () => {
  it('NAV-011 one notch turns one slide and prevents scrolling', () => {
    const input = new WheelInput();
    expect(input.handle(wheel(), ctx())).toEqual({ command: { type: 'Next' }, preventDefault: true });
    expect(input.handle(wheel({ deltaY: -NOTCH, t: 1000 }), ctx()).command).toEqual({ type: 'Previous' });
  });

  it('NAV-011 a second notch 100 ms later is ignored', () => {
    const input = new WheelInput();
    input.handle(wheel(), ctx());
    expect(input.handle(wheel({ t: QUICK_MS }), ctx()).command).toBeNull();
  });

  it('NAV-011 presentation mode turns slides too; line deltas are normalized', () => {
    const input = new WheelInput();
    expect(input.handle(wheel({ deltaY: 2, deltaMode: 1 }), ctx('presentation')).command).toEqual({ type: 'Next' });
  });

  it('NAV-012 zoomed, the wheel pans (Shift horizontally) and never turns slides', () => {
    const input = new WheelInput();
    expect(input.handle(wheel({ deltaX: 5, deltaY: 30 }), ctx('annotation', true)).command).toEqual({ type: 'Pan', dx: -5, dy: -30 });
    expect(input.handle(wheel({ deltaX: 0, deltaY: 30, shiftKey: true, t: 1000 }), ctx('annotation', true)).command).toEqual({ type: 'Pan', dx: -30, dy: 0 });
    expect(input.handle(wheel({ deltaY: 1, deltaMode: 1, t: 2000 }), ctx('annotation', true)).command).toEqual({ type: 'Pan', dx: 0, dy: -TUNABLES.gestures.wheel.lineHeightPx });
  });

  it('NAV-013 Ctrl+wheel zooms around the pointer in annotation and organization mode', () => {
    const input = new WheelInput();
    const expected = { type: 'ZoomBy', factor: Math.exp(-NOTCH * TUNABLES.gestures.wheel.zoomSensitivity), anchor: ANCHOR };
    expect(input.handle(wheel({ ctrlKey: true }), ctx('annotation'))).toEqual({ command: expected, preventDefault: true });
    expect(input.handle(wheel({ ctrlKey: true }), ctx('organization'))).toEqual({ command: expected, preventDefault: true });
  });

  it('NAV-017 Ctrl+wheel is ignored in presentation mode but never reaches the browser zoom', () => {
    expect(new WheelInput().handle(wheel({ ctrlKey: true }), ctx('presentation'))).toEqual({ command: null, preventDefault: true });
  });

  it('NAV-011 organization mode leaves the plain wheel to native scrolling', () => {
    expect(new WheelInput().handle(wheel(), ctx('organization'))).toEqual({ command: null, preventDefault: false });
  });
});
