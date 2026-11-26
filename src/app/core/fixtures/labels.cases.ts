/**
 * Fixtures: core/labels
 * Requirements: MRK-009..MRK-012
 * Expected values were derived by hand from the contract and checked with docs/reference/core-reference-4.mjs.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { LabelFormat, LabelInput } from '../labels';
import type { FileRef } from '../marks';

const f = (file: string, pageIndex: number, system: number): FileRef => ({ file, pageIndex, system });
const here = (pageIndex: number, system: number): FileRef => f('Sonata.pdf', pageIndex, system);

export const LABEL_FORMAT: LabelFormat = { separator: ':', jumpArrow: '->', passPrefix: '×' };

export const formatLabelCases: ReadonlyArray<{ id: string; req: string; name: string; input: LabelInput; currentFile: string; expected: string }> = [
  { id: 'L01', req: 'MRK-009', name: 'same file: page and system, both from 1', input: { from: here(0, 1) }, currentFile: 'Sonata.pdf', expected: '1:1' },
  { id: 'L02', req: 'MRK-009', name: 'the system number is the one on its page', input: { from: here(4, 2) }, currentFile: 'Sonata.pdf', expected: '5:2' },
  { id: 'L03', req: 'MRK-009', name: 'two-digit page and system', input: { from: here(11, 14) }, currentFile: 'Sonata.pdf', expected: '12:14' },
  { id: 'L04', req: 'MRK-009, MRK-012', name: 'another file carries its name', input: { from: f('Coda.pdf', 2, 1) }, currentFile: 'Sonata.pdf', expected: 'Coda.pdf:3:1' },
  { id: 'L05', req: 'MRK-009', name: 'file names are compared exactly', input: { from: f('sonata.pdf', 0, 1) }, currentFile: 'Sonata.pdf', expected: 'sonata.pdf:1:1' },
  { id: 'L06', req: 'MRK-009', name: 'a name with spaces and the separator is not altered', input: { from: f('Op. 1: Allegro.pdf', 0, 2) }, currentFile: 'Sonata.pdf', expected: 'Op. 1: Allegro.pdf:1:2' },
  { id: 'L07', req: 'MRK-010', name: 'jump with pass 1 shows no pass', input: { from: here(1, 3), to: here(0, 1), pass: 1 }, currentFile: 'Sonata.pdf', expected: '2:3 -> 1:1' },
  { id: 'L08', req: 'MRK-010', name: 'pass 2', input: { from: here(1, 3), to: here(0, 1), pass: 2 }, currentFile: 'Sonata.pdf', expected: '2:3 -> 1:1 ×2' },
  { id: 'L09', req: 'MRK-010', name: 'two-digit pass', input: { from: here(1, 3), to: here(0, 1), pass: 12 }, currentFile: 'Sonata.pdf', expected: '2:3 -> 1:1 ×12' },
  { id: 'L10', req: 'MRK-010, MRK-012', name: 'cross-file target', input: { from: here(1, 3), to: f('Coda.pdf', 0, 1), pass: 1 }, currentFile: 'Sonata.pdf', expected: '2:3 -> Coda.pdf:1:1' },
  { id: 'L11', req: 'MRK-009, MRK-012', name: 'seen from the target file the start carries the name', input: { from: here(1, 3), to: f('Coda.pdf', 0, 1), pass: 1 }, currentFile: 'Coda.pdf', expected: 'Sonata.pdf:2:3 -> 1:1' },
  { id: 'L12', req: 'MRK-009', name: 'seen from a third file both ends carry names', input: { from: here(1, 3), to: f('Coda.pdf', 0, 1), pass: 3 }, currentFile: 'Other.pdf', expected: 'Sonata.pdf:2:3 -> Coda.pdf:1:1 ×3' },
  { id: 'L13', req: 'MRK-011', name: 'user text follows the automatic part', input: { from: here(0, 1), text: 'Segno' }, currentFile: 'Sonata.pdf', expected: '1:1 Segno' },
  { id: 'L14', req: 'MRK-011', name: 'user text follows the pass', input: { from: here(1, 3), to: here(0, 1), pass: 3, text: 'D.S. al coda' }, currentFile: 'Sonata.pdf', expected: '2:3 -> 1:1 ×3 D.S. al coda' },
  { id: 'L15', req: 'MRK-011', name: 'empty text adds nothing', input: { from: here(0, 1), text: '' }, currentFile: 'Sonata.pdf', expected: '1:1' },
  { id: 'L16', req: 'MRK-011', name: 'blank text adds nothing', input: { from: here(0, 1), text: '   ' }, currentFile: 'Sonata.pdf', expected: '1:1' },
  { id: 'L17', req: 'MRK-011', name: 'text that looks like a label is appended unchanged', input: { from: here(0, 2), text: '-> 3:1 ×2' }, currentFile: 'Sonata.pdf', expected: '1:2 -> 3:1 ×2' },
  { id: 'L18', req: 'MRK-010', name: 'a pass without a target is ignored', input: { from: here(0, 1), pass: 4 }, currentFile: 'Sonata.pdf', expected: '1:1' },
];
