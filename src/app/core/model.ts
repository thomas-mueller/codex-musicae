/**
 * core/model — shared data types of the document model. Pure data, no logic.
 * Pages are 0-based (`pageIndex`); systems and junctions are numbered as in the glossary of requirements.md.
 */
import type { Rect } from './geometry';

/** Detection result of one page. `systems` are in display space, sorted top to bottom (ties left to right). */
export interface DetectedPage {
  readonly pageIndex: number;
  readonly width: number;
  readonly height: number;
  readonly systems: readonly Rect[];
}

/** One system in print order. `index` is 1-based across all pages that have systems. */
export interface SystemInfo {
  readonly index: number;
  readonly pageIndex: number;
  readonly box: Rect;
}

/**
 * One bar in organization mode: full page width (x = 0, width = page width implied),
 * vertical extent [y, y + height]. `junction` is 0..N. A junction on a page change has two bars.
 */
export interface Bar {
  readonly junction: number;
  readonly pageIndex: number;
  readonly y: number;
  readonly height: number;
}

/** A jump: when the n-th arrival (`pass`) at `origin` happens, continue at `target`. All junctions are 0..N. */
export interface Jump {
  readonly origin: number;
  readonly target: number;
  readonly pass: number;
}
