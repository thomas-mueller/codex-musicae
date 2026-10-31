import { vi } from 'vitest';
import type { Mock } from 'vitest';

export type FakeBitmap = ImageBitmap & { close: Mock };

const DEFAULT_SIDE = 10;

export function fakeBitmap(width = DEFAULT_SIDE, height = DEFAULT_SIDE): FakeBitmap {
  return { width, height, close: vi.fn() } as unknown as FakeBitmap;
}
