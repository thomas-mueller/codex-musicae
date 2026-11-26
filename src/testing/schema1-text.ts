// The JSON a V1 app embedded (schema 1). The app only reads it; tests need it written.
import type { MetadataPage } from '../app/core/metadata';
import type { V1Marks } from '../app/core/migrate-v1';

interface Schema1Input {
  readonly appVersion?: string;
  readonly pageCount: number;
  readonly detection: { readonly level: 'fast' | 'standard' | 'fine'; readonly pages: readonly MetadataPage[] } | null;
  readonly marks: V1Marks;
  readonly aspectRatio?: { readonly portrait?: number; readonly landscape?: number };
}

export function schema1Text({ appVersion = 'v1.0.0', pageCount, detection, marks, aspectRatio = {} }: Schema1Input): string {
  return JSON.stringify({
    schemaVersion: 1,
    appVersion,
    pageCount,
    detection:
      detection === null
        ? null
        : { level: detection.level, pages: detection.pages.map((p) => ({ ...p, systems: p.systems.map((r) => [r.x, r.y, r.width, r.height]) })) },
    marks,
    aspectRatio,
  });
}

const BOX = { x: 40, width: 500, height: 40 };
const FIRST_TOP = 10;
const SPACING = 50;

/** Detected pages with the given numbers of systems, stacked boxes of one size. */
export function schema1Pages(counts: readonly number[]): MetadataPage[] {
  return counts.map((count, pageIndex) => ({
    pageIndex,
    width: 595,
    height: 842,
    state: 'done' as const,
    systems: Array.from({ length: count }, (_, i) => ({ ...BOX, y: FIRST_TOP + SPACING * i })),
  }));
}
