/**
 * Fixtures: core/save-rules
 * Requirements: FIL-006, FIL-033, FIL-036, FIL-038, FIL-046, FIL-047, FIL-049. Written by hand from the requirement texts and DEC-166.
 */
import type { CloseInput, CloseStep, OverwriteInput, OverwriteVerdict } from '../save-rules';

const ASK: OverwriteInput = { answer: 'none', silencedAll: false, silencedName: false };

export const overwriteCases: ReadonlyArray<{ id: string; req: string; input: OverwriteInput; expected: OverwriteVerdict }> = [
  { id: 'OW1', req: 'FIL-033', input: ASK, expected: 'ask' },
  { id: 'OW2', req: 'FIL-033', input: { ...ASK, answer: 'allowed' }, expected: 'write' },
  { id: 'OW3', req: 'FIL-036', input: { ...ASK, answer: 'declined' }, expected: 'hold' },
  { id: 'OW4', req: 'FIL-038', input: { ...ASK, silencedAll: true }, expected: 'write' },
  { id: 'OW5', req: 'FIL-038', input: { ...ASK, silencedName: true }, expected: 'write' },
  // the answer of this session wins over a stored choice
  { id: 'OW6', req: 'FIL-036', input: { answer: 'declined', silencedAll: true, silencedName: true }, expected: 'hold' },
];

const DIRTY: CloseInput = { modified: true, canWrite: true, verdict: 'write' };

export const closeCases: ReadonlyArray<{ id: string; req: string; input: CloseInput; expected: CloseStep }> = [
  { id: 'CL1', req: 'FIL-047', input: { ...DIRTY, modified: false }, expected: 'close' },
  { id: 'CL2', req: 'FIL-047', input: { modified: false, canWrite: false, verdict: 'ask' }, expected: 'close' },
  { id: 'CL3', req: 'FIL-006', input: DIRTY, expected: 'save' },
  { id: 'CL4', req: 'FIL-033', input: { ...DIRTY, verdict: 'ask' }, expected: 'askOverwrite' },
  { id: 'CL5', req: 'FIL-049', input: { ...DIRTY, verdict: 'hold' }, expected: 'askDiscard' },
  // free, web and read-only files cannot be written
  { id: 'CL6', req: 'FIL-046', input: { ...DIRTY, canWrite: false }, expected: 'askDiscard' },
  { id: 'CL7', req: 'FIL-049', input: { ...DIRTY, canWrite: false, verdict: 'ask' }, expected: 'askDiscard' },
];
