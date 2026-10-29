import { describe, expect, it } from 'vitest';

import { shouldRegisterServiceWorker } from './app.config';

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
