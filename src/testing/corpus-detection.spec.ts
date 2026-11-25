import { enginesOf, expectedFor, profilesOf } from '../../scripts/lib/corpus-files.mjs';

const PROFILES = { 'v1-fast': { default: false }, 'v1-standard': { default: true }, 'v1-fine': { default: false } };
const COUNTS = [2, 2, 3];
interface TestEntry {
  systemsPerPage: number[];
  profiles?: string[];
  engines?: string[];
  deviations?: { profile: string; engine?: string; systemsPerPage: number[] }[];
}
const entry = (extra: Partial<TestEntry> = {}): TestEntry => ({ systemsPerPage: COUNTS, ...extra });

describe('corpus expectation choice', () => {
  it('TST-024 without a deviation the reviewed counts are expected', () => {
    expect(expectedFor(entry(), 'v1-standard', 'webkit')).toEqual(COUNTS);
  });

  it('TST-024 a deviation of the same profile and engine wins', () => {
    const e = entry({ deviations: [{ profile: 'v1-standard', engine: 'firefox', systemsPerPage: [2, 1, 3] }] });
    expect(expectedFor(e, 'v1-standard', 'firefox')).toEqual([2, 1, 3]);
  });

  it('TST-024 a deviation for another engine or another profile is ignored', () => {
    const e = entry({ deviations: [{ profile: 'v1-standard', engine: 'firefox', systemsPerPage: [9] }, { profile: 'v1-fine', systemsPerPage: [8] }] });
    expect(expectedFor(e, 'v1-standard', 'chromium')).toEqual(COUNTS);
    expect(expectedFor(e, 'v1-fast', 'firefox')).toEqual(COUNTS);
  });

  it('TST-024 a deviation without an engine applies to every engine; one that names the engine wins over it', () => {
    const e = entry({ deviations: [{ profile: 'v1-fine', systemsPerPage: [8] }, { profile: 'v1-fine', engine: 'webkit', systemsPerPage: [7] }] });
    expect(expectedFor(e, 'v1-fine', 'chromium')).toEqual([8]);
    expect(expectedFor(e, 'v1-fine', 'webkit')).toEqual([7]);
  });
});

describe('corpus profiles and engines of an entry', () => {
  it('TST-024 an entry runs under the default profiles and its own, each once', () => {
    expect(profilesOf(entry(), PROFILES)).toEqual(['v1-standard']);
    expect(profilesOf(entry({ profiles: ['v1-fine', 'v1-standard'] }), PROFILES)).toEqual(['v1-standard', 'v1-fine']);
  });

  it('TST-024 an entry runs on every desktop engine unless it narrows them', () => {
    expect(enginesOf(entry())).toEqual(['chromium', 'firefox', 'webkit']);
    expect(enginesOf(entry({ engines: ['chromium'] }))).toEqual(['chromium']);
  });
});
