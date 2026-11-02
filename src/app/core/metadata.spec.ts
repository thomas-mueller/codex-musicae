import { describe, expect, it } from 'vitest';

import { parseCases, reconcileCases, serializeCases } from './fixtures/metadata.cases';
import { parseMetadata, reconcileMetadata, serializeMetadata } from './metadata';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

describe('serializeMetadata', () => {
  for (const c of serializeCases) {
    it(caseTitle(c, 'SAV-004'), () => {
      expect(serializeMetadata(deepFreeze(structuredClone(c.metadata)))).toBe(c.expectedText);
    });
  }

  for (const c of serializeCases.filter((s) => s.metadata.detection === null || s.id === 'SM1')) {
    it(`SAV-002 ${c.id}: parse(serialize(m)) round-trips`, () => {
      const parsed = parseMetadata(serializeMetadata(c.metadata));
      expect(parsed.kind).toBe('ok');
      if (parsed.kind === 'ok') {
        expectCloseDeep(parsed.value, c.metadata);
      }
    });
  }
});

describe('parseMetadata', () => {
  for (const c of parseCases) {
    it(caseTitle(c, 'SAV-002'), () => {
      expectCloseDeep(parseMetadata(c.text), c.expected);
    });
  }
});

describe('reconcileMetadata', () => {
  for (const c of reconcileCases) {
    it(caseTitle(c, 'SAV-005'), () => {
      expect(reconcileMetadata(deepFreeze(structuredClone(c.metadata)), c.pageCount)).toEqual(c.expected);
    });
  }
});
