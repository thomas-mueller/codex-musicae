import { describe, expect, it } from 'vitest';

import type { Point } from './geometry';
import type { SlideComposition } from './composition';
import {
  applyActionCases,
  distanceToPolylineCases,
  inkTransformsCases,
  placementsAtCases,
  pointMappingCases,
  pushActionCases,
  simplifyPathCases,
  startOwnerCases,
  strokeHitCases,
  synComposition,
  undoRedoStepCases,
} from './fixtures/annotation.cases';
import { composeSlideCases } from './fixtures/composition.cases';
import type { InkTransform } from './annotation';
import {
  applyAction,
  distanceToPolyline,
  inkTransforms,
  placementsAt,
  pushAction,
  redoStep,
  simplifyPath,
  slidePointToUser,
  startOwner,
  strokeHit,
  undoStep,
  userPointToSlide,
} from './annotation';

const DIGITS = 9;
const SYN_ID = 'SYN';

function compositionOf(id: string): SlideComposition {
  if (id === SYN_ID) {
    return synComposition;
  }
  const found = composeSlideCases.find((c) => c.id === id);
  if (found === undefined) {
    throw new Error(`unknown composition ${id}`);
  }
  return found.expected;
}

function expectPoint(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, DIGITS);
  expect(actual.y).toBeCloseTo(expected.y, DIGITS);
}

function expectTransforms(actual: readonly InkTransform[], expected: readonly InkTransform[]): void {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((e, i) => {
    expect(actual[i]?.pageIndex).toBe(e.pageIndex);
    expect(actual[i]?.dx).toBeCloseTo(e.dx, DIGITS);
    expect(actual[i]?.dy).toBeCloseTo(e.dy, DIGITS);
  });
}

describe('simplifyPath', () => {
  for (const c of simplifyPathCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const input = structuredClone(c.points);
      const result = simplifyPath(c.points, c.epsilon);
      expect(result).toEqual(c.expected);
      expect(c.points).toEqual(input);
    });
  }
});

describe('distanceToPolyline', () => {
  for (const c of distanceToPolylineCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const result = distanceToPolyline(c.point, c.points);
      if (Number.isFinite(c.expected)) {
        expect(result).toBeCloseTo(c.expected, DIGITS);
      } else {
        expect(result).toBe(c.expected);
      }
    });
  }
});

describe('strokeHit', () => {
  for (const c of strokeHitCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(strokeHit(c.stroke, c.point, c.radiusPt)).toBe(c.expected);
    });
  }
});

describe('inkTransforms', () => {
  for (const c of inkTransformsCases) {
    it(`${c.req} ${c.id}: ${c.composition}`, () => {
      expectTransforms(inkTransforms(compositionOf(c.composition)), c.expected);
    });
  }
});

describe('startOwner', () => {
  for (const c of startOwnerCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const result = startOwner(compositionOf(c.composition), c.point);
      if (c.expected === null) {
        expect(result).toBeNull();
        return;
      }
      expect(result).not.toBeNull();
      expect(result?.pageIndex).toBe(c.expected.pageIndex);
      expect(result?.contentIndex).toBe(c.expected.contentIndex);
      expect(result?.dx).toBeCloseTo(c.expected.dx, DIGITS);
      expect(result?.dy).toBeCloseTo(c.expected.dy, DIGITS);
    });
  }
});

describe('placementsAt', () => {
  for (const c of placementsAtCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expectTransforms(placementsAt(compositionOf(c.composition), c.point), c.expected);
    });
  }
});

describe('slidePointToUser / userPointToSlide', () => {
  for (const c of pointMappingCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const user = slidePointToUser(c.owner, c.box, c.point);
      expectPoint(user, c.expectedUser);
      expectPoint(userPointToSlide(c.owner, c.box, c.expectedUser), c.expectedBack);
    });
  }
});

describe('pushAction', () => {
  for (const c of pushActionCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(pushAction(c.state, c.action, c.depth)).toEqual(c.expected);
    });
  }
});

describe('undoStep / redoStep', () => {
  for (const c of undoRedoStepCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const result = c.kind === 'undo' ? undoStep(c.state) : redoStep(c.state);
      expect(result).toEqual(c.expected);
    });
  }
});

describe('applyAction', () => {
  for (const c of applyActionCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      const input = structuredClone(c.strokes);
      expect(applyAction(c.strokes, c.action, c.direction)).toEqual(c.expected);
      expect(c.strokes).toEqual(input);
    });
  }
});
