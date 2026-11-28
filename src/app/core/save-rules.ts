/**
 * core/save-rules — whether a file may be overwritten and what closing it takes. Requirements: FIL-006, FIL-033, FIL-036,
 * FIL-038, FIL-046, FIL-047, FIL-049.
 */

/** What the user answered to the overwrite question for this file in this session. */
export type OverwriteAnswer = 'none' | 'allowed' | 'declined';
export type OverwriteVerdict = 'write' | 'ask' | 'hold';

export interface OverwriteInput {
  readonly answer: OverwriteAnswer;
  /** "Do not ask again" for all files, or for files of this name. */
  readonly silencedAll: boolean;
  readonly silencedName: boolean;
}

/** The answer of this session comes first (the question appears at most once); then the stored choices. */
export function overwriteVerdict({ answer, silencedAll, silencedName }: OverwriteInput): OverwriteVerdict {
  if (answer !== 'none') {
    return answer === 'allowed' ? 'write' : 'hold';
  }
  return silencedAll || silencedName ? 'write' : 'ask';
}

export type CloseStep = 'close' | 'save' | 'askOverwrite' | 'askDiscard';

export interface CloseInput {
  /** There are changes that are not in the file, or a save is running. */
  readonly modified: boolean;
  /** The build saves automatically and the file is not read-only. */
  readonly canWrite: boolean;
  readonly verdict: OverwriteVerdict;
}

/** Closing never drops changes without asking. */
export function closeStep({ modified, canWrite, verdict }: CloseInput): CloseStep {
  if (!modified) {
    return 'close';
  }
  if (!canWrite || verdict === 'hold') {
    return 'askDiscard';
  }
  return verdict === 'ask' ? 'askOverwrite' : 'save';
}
