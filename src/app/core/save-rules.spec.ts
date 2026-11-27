import { closeStep, overwriteVerdict } from './save-rules';
import { closeCases, overwriteCases } from './fixtures/save-rules.cases';

describe('overwriteVerdict', () => {
  for (const c of overwriteCases) {
    it(`${c.req} ${c.id}: ${c.expected}`, () => {
      expect(overwriteVerdict(c.input)).toBe(c.expected);
    });
  }
});

describe('closeStep', () => {
  for (const c of closeCases) {
    it(`${c.req} ${c.id}: ${c.expected}`, () => {
      expect(closeStep(c.input)).toBe(c.expected);
    });
  }
});
