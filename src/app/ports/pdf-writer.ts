/**
 * Port PdfWriter (first used in M15). Implementation: pdf-lib in a worker.
 * PROVISIONAL: M15 may refine this file; any change must be written back to docs/contracts.
 */
import { InjectionToken } from '@angular/core';
import type { Point } from '../core/geometry';
import type { Result } from './result';

export type PdfWriteError = 'invalid-pdf' | 'out-of-memory' | 'cancelled' | 'unknown';

export interface InkToAdd {
  readonly pageIndex: number;
  readonly strokeId: string; // stored as the annotation name (/NM)
  readonly points: readonly Point[]; // PDF user space of that page
  readonly color: string; // '#RRGGBB'
  readonly widthPt: number;
  readonly opacity: number; // 0..1
  readonly multiply: boolean; // highlighter blend mode
}

export interface ExistingInk {
  readonly pageIndex: number;
  readonly annotationRef: string; // opaque reference usable in `removeInk`
  readonly strokeId: string | null; // /NM if present
  readonly points: readonly Point[]; // PDF user space, all sub-paths concatenated in order
  readonly color: string;
  readonly widthPt: number;
  readonly opacity: number;
}

export interface PdfEdits {
  readonly addInk: readonly InkToAdd[];
  readonly removeInk: readonly { readonly pageIndex: number; readonly annotationRef: string }[];
  /** Replaces the embedded metadata attachment; null leaves it untouched. */
  readonly embeddedJson: string | null;
}

export interface PdfWriter {
  readEmbeddedJson(bytes: Uint8Array): Promise<Result<string | null, PdfWriteError>>;
  listInk(bytes: Uint8Array): Promise<Result<readonly ExistingInk[], PdfWriteError>>;
  /** Builds complete new file bytes; never touches `bytes`. */
  apply(bytes: Uint8Array, edits: PdfEdits, signal: AbortSignal): Promise<Result<Uint8Array, PdfWriteError>>;
}

export const PDF_WRITER = new InjectionToken<PdfWriter>('PdfWriter');
