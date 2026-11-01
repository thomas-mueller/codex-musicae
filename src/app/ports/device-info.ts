/** Port DeviceInfo (first used in M8): read-only device facts that size caches and render scales (NFR-004, NFR-005). */
import { InjectionToken } from '@angular/core';

export interface DeviceInfo {
  /** `navigator.deviceMemory` in GB (approximate), undefined when the platform does not tell. */
  deviceMemoryGb(): number | undefined;
  devicePixelRatio(): number;
  /** `prefers-reduced-motion: reduce`: animations are replaced by instant changes. */
  prefersReducedMotion(): boolean;
  /** Physical screen size in CSS px, whatever the orientation (SLD-014 fallback ratio). */
  screenSize(): { readonly width: number; readonly height: number };
}

export const DEVICE_INFO = new InjectionToken<DeviceInfo>('DeviceInfo');
