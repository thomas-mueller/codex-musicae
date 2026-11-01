import { composeSlide } from '../../core';
import type { SlideComposition } from '../../core';
import { composeSlideCases } from '../../core/fixtures/composition.cases';
import { tileComposition } from './tile-composition';

function fixture(id: string): SlideComposition {
  const c = composeSlideCases.find((x) => x.id === id);
  if (!c) {
    throw new Error(`fixture ${id} missing`);
  }
  return composeSlide(c.plan, c.systems, c.pages);
}

describe('tileComposition', () => {
  it('SLD-018 a tile covering the whole slide reproduces the composition', () => {
    const full = fixture('CP01');
    const tile = tileComposition(full, { x: 0, y: 0, width: full.width, height: full.height });
    expect(tile.contents).toEqual(full.contents);
    expect(tile.overlays).toEqual(full.overlays);
    expect(tile.width).toBe(full.width);
  });

  it('SLD-018 pieces are clipped consistently: source and dest shrink together and keep their mapping', () => {
    const full = fixture('CP01');
    const region = full.contents[0]!;
    const rect = { x: 100, y: region.dest.y + 10, width: 200, height: 50 };
    const tile = tileComposition(full, rect);
    const piece = tile.contents[0]!;
    expect(piece.dest).toEqual({ x: 0, y: 0, width: 200, height: 50 });
    expect(piece.source.width).toBe(200);
    expect(piece.source.height).toBe(50);
    expect(piece.source.x - region.source.x).toBeCloseTo(100 - region.dest.x);
    expect(piece.source.y - region.source.y).toBeCloseTo(rect.y - region.dest.y);
    expect(piece.pageIndex).toBe(region.pageIndex);
  });

  it('SLD-018 a tile that spans two pieces gets both, contiguous', () => {
    const full = fixture('CP01');
    const first = full.contents[0]!;
    const edge = first.dest.y + first.dest.height;
    const tile = tileComposition(full, { x: 0, y: edge - 20, width: full.width, height: 40 });
    expect(tile.contents.length).toBeGreaterThanOrEqual(2);
    expect(tile.contents[0]!.dest.y + tile.contents[0]!.dest.height).toBeCloseTo(20);
  });

  it('SLD-009 overlays are clipped to the tile', () => {
    const full = fixture('CP02');
    const overlay = full.overlays[0]!;
    const tile = tileComposition(full, { x: 10, y: overlay.y + 1, width: 100, height: 2 });
    expect(tile.overlays).toEqual([{ x: 0, y: 0, width: 100, height: 2 }]);
  });

  it('SLD-018 a tile outside every piece is empty', () => {
    const full = fixture('CP01');
    const tile = tileComposition(full, { x: full.width + 10, y: 0, width: 50, height: 50 });
    expect(tile.contents).toEqual([]);
    expect(tile.overlays).toEqual([]);
  });
});
