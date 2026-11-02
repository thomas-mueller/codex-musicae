import type { ExistingInk } from '../ports/pdf-writer';
import { loadInk } from './loaded-ink';

function ink(patch: Partial<ExistingInk> = {}): ExistingInk {
  return {
    pageIndex: 0,
    annotationRef: 'nm:a',
    strokeId: 'a',
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    color: '#ff0000',
    widthPt: 2,
    opacity: 1,
    ...patch,
  };
}

describe('loadInk (M15 S4)', () => {
  it('SAV-006 ANN-005 maps file ink to model strokes and saved references, keeping the file order', () => {
    const { strokes, saved } = loadInk([ink(), ink({ pageIndex: 1, annotationRef: 'nm:b', strokeId: 'b', color: '#00ff00' })], 2);
    expect(strokes).toEqual([
      { id: 'a', pageIndex: 0, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: '#ff0000', widthPt: 2, opacity: 1, multiply: false },
      { id: 'b', pageIndex: 1, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: '#00ff00', widthPt: 2, opacity: 1, multiply: false },
    ]);
    expect(saved).toEqual([
      { strokeId: 'a', pageIndex: 0, annotationRef: 'nm:a' },
      { strokeId: 'b', pageIndex: 1, annotationRef: 'nm:b' },
    ]);
  });

  it('SAV-006 ink without a name uses its object reference as id', () => {
    const { strokes, saved } = loadInk([ink({ strokeId: null, annotationRef: 'obj:12' })], 1);
    expect(strokes[0]?.id).toBe('obj:12');
    expect(saved).toEqual([{ strokeId: 'obj:12', pageIndex: 0, annotationRef: 'obj:12' }]);
  });

  it('SAV-006 a transparent stroke is a highlighter (multiply), an opaque one is a pen', () => {
    const { strokes } = loadInk([ink({ opacity: 0.35 }), ink({ strokeId: 'p', annotationRef: 'nm:p', opacity: 1 })], 1);
    expect(strokes.map((s) => s.multiply)).toEqual([true, false]);
  });

  it('SAV-006 strokes without points, on missing pages, or with a taken id are not shown', () => {
    const { strokes, saved } = loadInk(
      [ink({ points: [] }), ink({ strokeId: 'p', annotationRef: 'nm:p', pageIndex: 5 }), ink(), ink({ points: [{ x: 9, y: 9 }] })],
      2,
    );
    expect(strokes.map((s) => s.id)).toEqual(['a']);
    expect(strokes[0]?.points).toHaveLength(2);
    expect(saved).toHaveLength(1);
  });

  it('SAV-006 nothing to load gives nothing', () => {
    expect(loadInk([], 3)).toEqual({ strokes: [], saved: [] });
  });
});
