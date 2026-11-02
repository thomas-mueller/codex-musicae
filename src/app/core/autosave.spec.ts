import { describe, expect, it } from 'vitest';

import { reduceSave, SAVE_INITIAL, saveDecision } from './autosave';
import type { SaveDecision } from './autosave';
import { autosaveCases } from './fixtures/autosave.cases';
import { caseTitle } from '../../testing/expect-close-deep';

/** The idle delay the fixtures are computed with. */
const IDLE_MS = 3000;

describe('reduceSave / saveDecision', () => {
  for (const c of autosaveCases) {
    it(caseTitle(c, 'SAV-008'), () => {
      let state = SAVE_INITIAL;
      const decisions: SaveDecision[] = [];
      for (const step of c.steps) {
        if ('event' in step) {
          state = reduceSave(Object.freeze({ ...state }), step.event);
        } else {
          decisions.push(saveDecision(state, step.check, IDLE_MS));
        }
      }
      expect(decisions).toEqual(c.expected.checks.map((k) => k.expected));
      expect(c.steps.filter((s) => 'check' in s).map((s) => ('check' in s ? s.check : -1))).toEqual(
        c.expected.checks.map((k) => k.now),
      );
      expect(state).toEqual(c.expected.finalState);
    });
  }
});
