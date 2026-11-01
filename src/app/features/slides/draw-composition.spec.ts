import { TUNABLES } from '../../../config/tunables';
import { composeSlide } from '../../core';
import { composeSlideCases } from '../../core/fixtures/composition.cases';
import { drawComposition } from './draw-composition';
import type { SlideContext } from './draw-composition';

type Call = readonly [string, ...unknown[]];

/** Records fillStyle / globalAlpha assignments and calls in order. */
function recorder(): { context: SlideContext; calls: Call[] } {
  const calls: Call[] = [];
  const context: SlideContext = {
    set fillStyle(value) {
      calls.push(['fillStyle', value]);
    },
    get fillStyle() {
      return '';
    },
    set globalAlpha(value) {
      calls.push(['globalAlpha', value]);
    },
    get globalAlpha() {
      return 1;
    },
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    drawImage: (image, ...args) => calls.push(['drawImage', image, ...args]),
  };
  return { context, calls };
}

const bitmapsFor = (count: number): ImageBitmap[] => Array.from({ length: count }, () => ({}) as ImageBitmap);

function expected(id: string, pxPerUnit: number, bitmaps: ImageBitmap[]): Call[] {
  const c = composeSlideCases.find((x) => x.id === id);
  if (!c) {
    throw new Error(`fixture ${id} missing`);
  }
  const grey = TUNABLES.colors.canvasGrey;
  const p = pxPerUnit;
  const e = c.expected;
  const calls: Call[] = [['fillStyle', grey], ['fillRect', 0, 0, e.width * p, e.height * p]];
  e.contents.forEach((content, i) => {
    calls.push(['drawImage', bitmaps[i], content.dest.x * p, content.dest.y * p, content.dest.width * p, content.dest.height * p]);
  });
  for (const o of e.overlays) {
    calls.push(['globalAlpha', TUNABLES.colors.overlayOpacity], ['fillStyle', grey], ['fillRect', 0, o.y * p, o.width * p, o.height * p], ['globalAlpha', 1]);
  }
  return calls;
}

function draw(id: string, pxPerUnit: number): { calls: Call[]; bitmaps: ImageBitmap[] } {
  const c = composeSlideCases.find((x) => x.id === id);
  if (!c) {
    throw new Error(`fixture ${id} missing`);
  }
  const composition = composeSlide(c.plan, c.systems, c.pages);
  const bitmaps = bitmapsFor(composition.contents.length);
  const { context, calls } = recorder();
  drawComposition(context, composition, bitmaps, pxPerUnit);
  return { calls, bitmaps };
}

describe('drawComposition', () => {
  for (const id of ['CP01', 'CP02', 'CP06']) {
    it(`SLD-007 ${id}: grey background, one drawImage per content, overlays with the overlay opacity`, () => {
      const { calls, bitmaps } = draw(id, 1);
      const want = expected(id, 1, bitmaps);
      expect(calls.length).toBe(want.length);
      calls.forEach((call, i) => {
        const [name, ...args] = call;
        const [wantName, ...wantArgs] = want[i] ?? [];
        expect(name).toBe(wantName);
        args.forEach((arg, k) => (typeof arg === 'number' ? expect(arg).toBeCloseTo(wantArgs[k] as number, 9) : expect(arg).toBe(wantArgs[k])));
      });
    });
  }

  it('SLD-009 CP02 has at least one overlay and the alpha is reset after each', () => {
    const { calls } = draw('CP02', 1);
    const alphas = calls.filter((c) => c[0] === 'globalAlpha').map((c) => c[1]);
    expect(alphas.length).toBeGreaterThan(0);
    expect(alphas.length % 2).toBe(0);
    alphas.forEach((a, i) => expect(a).toBe(i % 2 === 0 ? TUNABLES.colors.overlayOpacity : 1));
  });

  it('SLD-010 every coordinate scales with pxPerUnit', () => {
    const one = draw('CP01', 1).calls;
    const two = draw('CP01', 2).calls;
    expect(two.length).toBe(one.length);
    one.forEach((call, i) => {
      if (call[0] === 'fillRect') {
        (two[i] ?? []).slice(1).forEach((v, k) => expect(v as number).toBeCloseTo((call[k + 1] as number) * 2, 9));
      }
    });
  });

  it('SLD-007 a missing bitmap leaves the grey background there', () => {
    const c = composeSlideCases.find((x) => x.id === 'CP01');
    if (!c) {
      throw new Error('fixture CP01 missing');
    }
    const composition = composeSlide(c.plan, c.systems, c.pages);
    const { context, calls } = recorder();
    drawComposition(context, composition, [], 1);
    expect(calls.some((call) => call[0] === 'drawImage')).toBe(false);
    expect(calls[1]?.[0]).toBe('fillRect');
  });
});
