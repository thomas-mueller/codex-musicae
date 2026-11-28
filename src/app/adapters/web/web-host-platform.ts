import type { HostPlatformName } from '../../ports/host-platform';

/**
 * `navigator.platform`, in the browser and in the native web view. It is deprecated, but every engine still answers it,
 * and its successor `userAgentData` is Chromium only. NAV-021
 */
// UNVERIFIED(ios): an iPhone is expected to answer "iPhone" and an iPad "iPad" or "MacIntel".
export const webHostPlatform: HostPlatformName = () => navigator.platform;
