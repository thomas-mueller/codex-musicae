import type { DeviceInfo } from '../../ports/device-info';

export class WebDeviceInfo implements DeviceInfo {
  deviceMemoryGb(): number | undefined {
    return (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  }

  devicePixelRatio(): number {
    return window.devicePixelRatio || 1;
  }

  prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
