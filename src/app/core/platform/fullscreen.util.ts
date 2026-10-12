export type FullscreenEnvironment = 'standalone' | 'browser';

export function getFullscreenEnvironment(
  displayMode = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false,
  navigatorStandalone = typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true,
): FullscreenEnvironment {
  return displayMode || navigatorStandalone ? 'standalone' : 'browser';
}

export function canRequestFullscreen(element: Element | undefined): element is Element & { requestFullscreen: () => Promise<void> } {
  return !!element && typeof (element as Element & { requestFullscreen?: unknown }).requestFullscreen === 'function';
}

export function isAndroidBrowser(userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''): boolean {
  return /Android/i.test(userAgent);
}
