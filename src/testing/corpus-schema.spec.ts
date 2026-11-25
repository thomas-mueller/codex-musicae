import { readFileSync } from 'node:fs';

import { entriesOf } from '../../scripts/lib/corpus-files.mjs';
import { ENGINES, SUITES, validateEntry, type CorpusEntry } from '../../scripts/lib/corpus-schema.mjs';

const PROFILES = { 'v1-fast': { default: false }, 'v1-standard': { default: true }, 'v1-fine': { default: false } };
const VALID: CorpusEntry = { file: 'a.pdf', suites: ['detection'], systemsPerPage: [2, 2], note: '', reviewed: true };
const LOAD_ONLY: CorpusEntry = { file: 'big.pdf', suites: ['load'], systemsPerPage: [], pages: 281, note: '', reviewed: true };
const problems = (entry: Partial<CorpusEntry>): string[] => validateEntry(entry, PROFILES);

describe('corpus entry schema', () => {
  it('TST-023 a valid detection entry, a load-only entry and an entry in both suites have no problems', () => {
    expect(problems(VALID)).toEqual([]);
    expect(problems(LOAD_ONLY)).toEqual([]);
    expect(problems({ ...VALID, suites: ['detection', 'load'], tags: ['long'] })).toEqual([]);
  });

  it('TST-023 an unknown or missing suite is rejected', () => {
    expect(problems({ ...VALID, suites: ['speed'] })).toEqual(['unknown suite "speed"']);
    expect(problems({ ...VALID, suites: [] })).toContain('suites must be a non-empty list');
    expect(SUITES).toEqual(['detection', 'load']);
  });

  it('TST-023 an unknown profile is rejected, a known one is accepted', () => {
    expect(problems({ ...VALID, profiles: ['v1-fine'] })).toEqual([]);
    expect(problems({ ...VALID, profiles: ['v9'] })).toEqual(['unknown profile "v9"']);
  });

  it('TST-023 an unknown engine is rejected, a known subset needs a note', () => {
    expect(problems({ ...VALID, engines: ['chromium', 'firefox', 'webkit'] })).toEqual([]);
    expect(problems({ ...VALID, engines: ['chromium', 'edge'], note: 'x' })).toEqual(['unknown engine "edge"']);
    expect(ENGINES).toEqual(['chromium', 'firefox', 'webkit']);
  });

  it('TST-023 a detection entry without counts is rejected', () => {
    expect(problems({ ...VALID, systemsPerPage: [] })).toEqual(['a detection entry needs systemsPerPage']);
    expect(problems({ file: 'x.pdf', suites: ['detection'], note: '' })).toContain('a detection entry needs systemsPerPage');
  });

  it('TST-023 a load-only entry with counts is rejected, a load entry that is also a detection entry may have them', () => {
    expect(problems({ ...LOAD_ONLY, systemsPerPage: [3] })).toEqual(['a load-only entry has no systemsPerPage']);
    expect(problems({ ...VALID, suites: ['detection', 'load'] })).toEqual([]);
  });

  it('TST-023 an entry with counts but without reviewed is rejected', () => {
    const unmarked: Partial<CorpusEntry> = { ...VALID };
    delete unmarked.reviewed;
    expect(problems(unmarked)).toEqual(['an entry with counts needs reviewed']);
    expect(problems({ ...VALID, reviewed: false })).toEqual([]);
  });

  it('TST-023 narrowing engines without a note is rejected, with a note it is accepted', () => {
    expect(problems({ ...VALID, engines: ['chromium'] })).toEqual(['narrowing engines needs a note']);
    expect(problems({ ...VALID, engines: ['chromium'], note: '  ' })).toEqual(['narrowing engines needs a note']);
    expect(problems({ ...VALID, engines: ['chromium'], note: 'WebKit runs out of memory' })).toEqual([]);
    expect(problems({ ...VALID, engines: [] })).toContain('engines must not be empty (leave it out to run on every engine)');
  });

  it('TST-023 a deviation must name a known profile and engine and carry counts', () => {
    const deviation = { profile: 'v1-standard', engine: 'firefox', systemsPerPage: [2, 1], note: 'why' };
    expect(problems({ ...VALID, deviations: [deviation] })).toEqual([]);
    expect(problems({ ...VALID, deviations: [{ ...deviation, profile: 'nope' }] })).toEqual(['deviation names unknown profile "nope"']);
    expect(problems({ ...VALID, deviations: [{ ...deviation, engine: 'edge' }] })).toEqual(['deviation names unknown engine "edge"']);
    expect(problems({ ...VALID, deviations: [{ profile: 'v1-fast' } as never] })).toEqual(['a deviation needs systemsPerPage']);
  });
});

describe('corpus suites', () => {
  const entries = [VALID, LOAD_ONLY, { ...VALID, file: 'both.pdf', suites: ['detection', 'load'] }];

  it('TST-023 entriesOf selects the entries of a suite; an entry of both suites is in each', () => {
    expect(entriesOf(entries, 'detection').map((e) => e.file)).toEqual(['a.pdf', 'both.pdf']);
    expect(entriesOf(entries, 'load').map((e) => e.file)).toEqual(['big.pdf', 'both.pdf']);
    expect(entriesOf(entries, 'other')).toEqual([]);
    expect(entriesOf([{ file: 'old.pdf' } as { suites?: string[] }], 'detection')).toEqual([]);
  });
});

/** The reviewed counts of expected.json before the V2 migration (V2-M3b S1): the migration must not change any of them. */
const BEFORE: Record<string, { counts: number[]; reviewed: boolean; note: string; pages?: number; load?: boolean }> = {
  "IMSLP01777-Mozart_EineKleineNachtmusik_ViolinI.pdf": { counts: [10,13,12,12,12,12], reviewed: true, note: "" },
  "IMSLP621557-PMLP863228-beethoven--sonatas-vol1.pdf": { counts: [], reviewed: true, note: "stress file: only the responsiveness tests use it", pages: 281, load: true },
  "IMSLP799145-PMLP14377-tiff2pdf_-2.pdf": { counts: [1,0,6,6,6], reviewed: true, note: "" },
  "IMSLP914565-PMLP5176-mozart_serenade_k.525_wpv.pdf": { counts: [0,0,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4], reviewed: true, note: "" },
  "IMSLP1022763-PMLP01586-91257-mu.98.pdf": { counts: [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,3,2,2,4,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1], reviewed: true, note: "" },
  "IMSLP19899-PMLP01586-Beethoven_Symphony_5_V1.pdf": { counts: [11,13,13,13,13,13,14,14,13,12,12,13], reviewed: true, note: "" },
  "IMSLP19900-PMLP01586-Beethoven_Symphony_5_V2.pdf": { counts: [13,14,14,14,14,12,13,13,13], reviewed: true, note: "" },
  "IMSLP23764-PMLP01586-Beethoven_Symphony5_Cls.pdf": { counts: [13,14,14,14,15,14,14,15,15,14,15], reviewed: true, note: "" },
  "IMSLP26216-PMLP01586-Beethoven_-_Symphony_No5_in_C_minor_Op67_-cello-part-a.pdf": { counts: [9,11,12,10,11,10,13,13,11,9,12,12], reviewed: true, note: "" },
  "IMSLP27535-PMLP01586-Beethoven_Sym5_Obs.pdf": { counts: [13,14,14,14,14,14,14,15,15,15], reviewed: true, note: "" },
  "IMSLP27536-PMLP01586-Beethoven_Sym5_LowBrs.pdf": { counts: [11,15,9,9,8,11,15,9,9,8,11,15], reviewed: true, note: "" },
  "IMSLP27537-PMLP01586-Beethoven_Sym5_Vla.pdf": { counts: [13,14,13,13,13,13,12,13,13,13,13], reviewed: true, note: "" },
  "IMSLP35620-PMLP01586-Beethoven-Op067.Bassoon.pdf": { counts: [14,15,15,15,15,15,14,13,13,14,15,15,14,15], reviewed: true, note: "" },
  "IMSLP30601-PMLP01586-bs5fp.pdf": { counts: [12,13,14,13,13,13,12,14,15,15,11,14], reviewed: true, note: "" },
  "IMSLP35621-PMLP01586-Beethoven-Op067.Horn.pdf": { counts: [12,13,13,13,13,13,12,14,13,13,13,13,12,13,13,13,13,13,12,13,13,13,13,13], reviewed: true, note: "" },
  "IMSLP35622-PMLP01586-Beethoven-Op067.Trumpet.pdf": { counts: [12,14,15,15,10,11,12,12,12,13,14,15,14,10,11,12,11,12], reviewed: true, note: "" },
  "IMSLP35623-PMLP01586-Beethoven-Op067.Timpani.pdf": { counts: [14,15,15,15], reviewed: true, note: "" },
};

describe('expected.json after the migration', () => {
  const entries = JSON.parse(readFileSync('e2e/corpus/expected.json', 'utf8')) as CorpusEntry[];
  const profiles = JSON.parse(readFileSync('e2e/corpus/profiles.json', 'utf8')) as Record<string, { default?: boolean }>;

  it('TST-023 profiles.json has exactly one default profile', () => {
    expect(Object.values(profiles).filter((p) => p.default === true)).toHaveLength(1);
    expect(profiles['v1-standard']?.default).toBe(true);
  });

  it('TST-023 every entry validates against profiles.json and no V1 field is left', () => {
    for (const entry of entries) {
      expect(validateEntry(entry, profiles), entry.file).toEqual([]);
      for (const gone of ['level', 'knownLimitation', 'stress']) expect(gone in entry, `${entry.file} still has ${gone}`).toBe(false);
    }
  });

  it('TST-023 no file, count, review flag or note changed; the stress file is the load entry', () => {
    expect(entries.map((e) => e.file).sort()).toEqual(Object.keys(BEFORE).sort());
    for (const entry of entries) {
      const before = BEFORE[entry.file] as NonNullable<(typeof BEFORE)[string]>;
      expect(entry.systemsPerPage, entry.file).toEqual(before.counts);
      expect(entry.reviewed, entry.file).toBe(before.reviewed);
      expect(entry.note, entry.file).toBe(before.note);
      expect(entry.pages, entry.file).toBe(before.pages);
      expect(entry.suites, entry.file).toEqual(before.load === true ? ['load'] : ['detection']);
    }
  });
});
