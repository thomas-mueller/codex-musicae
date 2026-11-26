/**
 * core/labels — the automatic label of a mark. Requirements: MRK-009..MRK-012.
 */
import type { FileRef } from './marks';

/** The separators; the caller passes them in (they live in tunables). */
export interface LabelFormat {
  /** Between file name, page and system on page. */
  readonly separator: string;
  /** Between the start and the target of a jump. */
  readonly jumpArrow: string;
  /** Directly before a pass number above 1. */
  readonly passPrefix: string;
}

export interface LabelInput {
  /** The system of the mark (for a jump: its start). `file` is the file that holds this system. */
  readonly from: FileRef;
  /** Jumps only: the target system and the file that holds it. */
  readonly to?: FileRef;
  /** Jumps only; ignored without `to`. */
  readonly pass?: number;
  /** Optional user text (MRK-011). */
  readonly text?: string;
}

/**
 * place(p)  = (p.file === currentFile ? '' : p.file + separator) + (p.pageIndex + 1) + separator + p.system
 *   - the file name is used as stored, extension included, and compared exactly (case-sensitive);
 *   - the page is the page of the PDF (pages without systems count), 1-based.
 * label     = place(from)
 *   + (to present:             ' ' + jumpArrow + ' ' + place(to))
 *   + (to present, pass > 1:   ' ' + passPrefix + pass)
 *   + (text not blank:         ' ' + text)              // the automatic part comes first; text is appended unchanged
 * `currentFile` is the file the viewer looks at; the name is omitted per place, so one label may name one file only.
 */
export function formatLabel(_input: LabelInput, _currentFile: string, _format: LabelFormat): string {
  throw new Error('not implemented');
}
