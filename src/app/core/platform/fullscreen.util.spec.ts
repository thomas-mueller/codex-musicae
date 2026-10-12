import { canRequestFullscreen, getFullscreenEnvironment, isAndroidBrowser } from './fullscreen.util';

describe('fullscreen utilities', () => {
  it('recognizes standalone display mode and iOS standalone mode', () => {
    expect(getFullscreenEnvironment(true, false)).toBe('standalone');
    expect(getFullscreenEnvironment(false, true)).toBe('standalone');
    expect(getFullscreenEnvironment(false, false)).toBe('browser');
  });

  it('detects Android user agents without affecting desktop browsers', () => {
    expect(isAndroidBrowser('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(true);
    expect(isAndroidBrowser('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36')).toBe(false);
  });

  it('only reports fullscreen support when requestFullscreen exists', () => {
    expect(canRequestFullscreen({ requestFullscreen: async () => undefined } as Element)).toBe(true);
    expect(canRequestFullscreen({} as Element)).toBe(false);
    expect(canRequestFullscreen(undefined)).toBe(false);
  });
});
