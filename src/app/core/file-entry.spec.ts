import { adjacentFile, fileMarkers } from './file-entry';
import { adjacentFileCases, fileMarkerCases } from './fixtures/file-entry.cases';

describe('fileMarkers', () => {
  for (const c of fileMarkerCases) {
    it(`${c.req} ${c.id}: [${c.expected.join(', ')}]`, () => {
      expect(fileMarkers(c.flags)).toEqual(c.expected);
    });
  }
});

describe('adjacentFile', () => {
  for (const c of adjacentFileCases) {
    it(`${c.req} ${c.id}: [${c.ids.join(', ')}] from ${c.active} by ${c.step} -> ${c.expected}`, () => {
      expect(adjacentFile(c.ids, c.active, c.step)).toBe(c.expected);
    });
  }
});
