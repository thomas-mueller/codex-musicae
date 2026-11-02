import { describe, expect, it } from 'vitest';

import {
  classifyTrackCases,
  doubleTapCases,
  gestureLimits,
  pointerPolicyCases,
  tapZoneCases,
  tapZones,
  wheelCases,
  wheelConfig,
} from './fixtures/gestures.cases';
import { classifyTrack, isDoubleTap, pointerPolicy, tapZoneOf, WHEEL_INITIAL, wheelStep } from './gestures';

const DIGITS = 9;

describe('classifyTrack', () => {
  for (const c of classifyTrackCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(classifyTrack(c.track, c.viewportWidth, gestureLimits)).toBe(c.expected);
    });
  }
});

describe('tapZoneOf', () => {
  for (const c of tapZoneCases) {
    it(`${c.req} ${c.id}: x=${c.x}`, () => {
      expect(tapZoneOf(c.x, c.viewportWidth, tapZones)).toBe(c.expected);
    });
  }
});

describe('isDoubleTap', () => {
  for (const c of doubleTapCases) {
    it(`${c.req} ${c.id}`, () => {
      expect(isDoubleTap(c.a, c.b, c.limits)).toBe(c.expected);
    });
  }
});

describe('wheelStep', () => {
  for (const c of wheelCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      let state = WHEEL_INITIAL;
      const steps: Array<-1 | 0 | 1> = [];
      for (const event of c.events) {
        const result = wheelStep(state, event, wheelConfig);
        state = result.state;
        steps.push(result.step);
      }
      expect(steps).toEqual(c.expectedSteps);
      expect(state.accum).toBeCloseTo(c.expectedFinalState.accum, DIGITS);
      expect(state.lastT).toBeCloseTo(c.expectedFinalState.lastT, DIGITS);
      expect(state.stepT).toEqual(c.expectedFinalState.stepT);
    });
  }
});

describe('pointerPolicy', () => {
  for (const c of pointerPolicyCases) {
    it(`${c.req} ${c.id}: ${c.name}`, () => {
      expect(pointerPolicy(c.ctx)).toEqual(c.expected);
    });
  }
});
