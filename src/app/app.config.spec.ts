import { describe, expect, it } from 'vitest';

import { hasBackButton, shouldRegisterServiceWorker } from './app.config';

describe('composition-root service-worker guard', () => {
  it('PLT-009 skips registration for a native Capacitor platform', () => {
    const nativeCapacitor = { isNativePlatform: () => true };

    expect(shouldRegisterServiceWorker(false, nativeCapacitor)).toBe(false);
  });

  it('PLT-009 permits registration for a production web platform', () => {
    const webCapacitor = { isNativePlatform: () => false };

    expect(shouldRegisterServiceWorker(false, webCapacitor)).toBe(true);
  });

  it('PLT-009 skips registration for development builds', () => {
    const webCapacitor = { isNativePlatform: () => false };

    expect(shouldRegisterServiceWorker(true, webCapacitor)).toBe(false);
  });
});

describe('composition-root back-button guard', () => {
  it('PLT-007 registers the back button on Android', () => {
    expect(hasBackButton({ getPlatform: () => 'android' })).toBe(true);
  });

  it('PLT-013 iOS keeps the native Capacitor adapters but registers no back button', () => {
    const ios = { getPlatform: () => 'ios', isNativePlatform: () => true };

    expect(ios.isNativePlatform()).toBe(true);
    expect(hasBackButton(ios)).toBe(false);
  });

  it('PLT-007 registers no back button on the web', () => {
    expect(hasBackButton({ getPlatform: () => 'web' })).toBe(false);
  });
});
