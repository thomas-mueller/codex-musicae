/**
 * core/slides — slide packing. Requirements: SLD-001..SLD-006, SLD-012.
 * All geometry in page display space (PDF points).
 */
import type { Rect } from './geometry';

/** A system with its padded area (clamped to the page), as produced by `paddedArea`. */
export interface SystemGeom {
  readonly index: number; // 1-based print index
  readonly pageIndex: number;
  readonly box: Rect;
  readonly padded: Rect;
}

export interface PackInput {
  /** Playing order: system indices (1..N). */
  readonly entries: readonly number[];
  /** forcedBreakAfter[i] === true forces a slide boundary between entries[i] and entries[i+1]. Length = entries.length - 1. */
  readonly forcedBreakAfter: readonly boolean[];
  /** All systems; systems[k].index === k + 1. */
  readonly systems: readonly SystemGeom[];
  /** W_ref: slide width in PDF units (SLD-002). */
  readonly slideWidth: number;
  /** r = width / height of a normal slide. */
  readonly aspectRatio: number;
}

/** A vertical piece of a slide: one system, or several consecutive entries adjacent in print order on one page. */
export interface Region {
  readonly pageIndex: number;
  readonly firstSystem: number;
  readonly lastSystem: number;
  /** Union (bounding box) of the padded areas of its systems, in page display space. */
  readonly area: Rect;
  /** Inclusive range of entry positions (0-based indices into `entries`). */
  readonly entryStart: number;
  readonly entryEnd: number;
}

export interface SlidePlan {
  /** Inclusive range of entry positions (0-based indices into `entries`). */
  readonly entryStart: number;
  readonly entryEnd: number;
  readonly regions: readonly Region[];
  /** Logical slide size in PDF units (enlarged slides: height = stackHeight, width = height * aspectRatio). */
  readonly width: number;
  readonly height: number;
  /** Sum of the region heights. */
  readonly stackHeight: number;
  /** True when a single region was taller than the normal slide height (SLD-006). */
  readonly enlarged: boolean;
}

/** SLD-002: maximum `padded.width` over all systems. */
export function referenceWidth(_systems: readonly SystemGeom[]): number {
  throw new Error('not implemented');
}

/**
 * Greedy packing in playing order. H = slideWidth / aspectRatio.
 * For each entry i (in order) with system s:
 *   - If a slide is open and forcedBreakAfter[i - 1] is not true, try to add s:
 *       adjacent = entries[i] === entries[i-1] + 1 AND the two systems are on the same page.
 *       If adjacent: merge into the LAST region (area = union of the old area and s.padded; lastSystem = s.index; entryEnd = i).
 *       Else: append a new region (area = s.padded).
 *       stack = sum of region area heights. If stack <= H + 1e-9: accept and continue with the next entry.
 *   - Otherwise close the open slide and open a new one whose only region is s (entryStart = i).
 * When closing: enlarged = stack > H + 1e-9; height = enlarged ? stack : H; width = enlarged ? height * aspectRatio : slideWidth.
 * An enlarged slide always holds a single entry. No entries -> []. Slide entry ranges cover 0..entries.length-1 without gaps.
 */
export function packSlides(_input: PackInput): SlidePlan[] {
  throw new Error('not implemented');
}

/** Index of the slide whose [entryStart, entryEnd] contains `entryIndex`, or -1. */
export function slideIndexOfEntry(_slides: readonly SlidePlan[], _entryIndex: number): number {
  throw new Error('not implemented');
}

/**
 * Entry position (index into `entries`) that represents `systemIndex` after the playing order changed (SLD-012, FIL-014):
 *  - the first entry whose value equals systemIndex;
 *  - else the first entry (lowest position) whose value is the smallest value greater than systemIndex;
 *  - else the last entry position;
 *  - -1 if `entries` is empty.
 */
export function findEntryForSystem(_entries: readonly number[], _systemIndex: number): number {
  throw new Error('not implemented');
}
