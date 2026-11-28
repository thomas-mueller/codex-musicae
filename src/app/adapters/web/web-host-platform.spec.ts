import { webHostPlatform } from './web-host-platform';

describe('webHostPlatform', () => {
  it('NAV-021 reads the platform name of the browser', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expect(webHostPlatform()).toBe('MacIntel');
    vi.restoreAllMocks();
  });
});
