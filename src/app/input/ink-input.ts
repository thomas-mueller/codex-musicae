import { inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { clientToSlide, placementsAt, simplifyPath, slidePointToUser, startOwner, strokeHit } from '../core';
import type { InkStroke, PageBox, Point, Rect, SlideComposition, StrokeOwner } from '../core';
import type { DocumentStore } from '../state/document.store';
import { SessionStore } from '../state/session.store';
import { SlideNavStore } from '../state/slide-nav.store';
import { ToolSettingsStore } from '../state/tool-settings.store';
import type { StrokeStyle } from '../state/tool-settings.store';
import { UiStore } from '../state/ui.store';
import type { ViewState } from '../core';

/** Where the stroke is shown while it is drawn; slide-space points. Implemented by the slide view. */
export interface LiveStroke {
  begin(style: StrokeStyle): void;
  add(points: readonly Point[]): void;
  clear(): void;
}

export interface InkSurface {
  composition(): SlideComposition | null;
  readonly live: LiveStroke;
  /** The eraser hides the strokes it has touched until the gesture ends (an empty set shows all again). */
  hideStrokes(ids: ReadonlySet<string>): void;
}

interface Drawing {
  readonly doc: DocumentStore;
  readonly owner: StrokeOwner;
  readonly box: PageBox;
  readonly style: StrokeStyle;
  readonly surface: InkSurface;
  readonly stageRect: Rect;
  readonly view: ViewState;
  readonly displayScale: number;
  readonly slideSize: { width: number; height: number };
  readonly points: Point[];
}

/** The eraser gesture: the strokes touched so far stay in the model until the pointer is released. */
interface Erasing {
  readonly doc: DocumentStore;
  readonly surface: InkSurface;
  readonly composition: SlideComposition;
  readonly stageRect: Rect;
  readonly view: ViewState;
  readonly displayScale: number;
  readonly hits: Map<string, InkStroke>;
}

let idCounter = 0;

function newStrokeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${++idCounter}-${Math.random()}`;
}

/**
 * One stroke at a time, from the first pointer-down to the pointer-up. Imperative and free of signal writes per point
 * (ANN-011); the only reactive writes are `strokeStarted`/`strokeEnded` of the document. Points are stored in PDF user
 * space of the page that owns the start point, using the owner's translation for all points. ANN-009, ANN-010
 */
@Injectable({ providedIn: 'root' })
export class InkInput {
  private readonly ui = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly nav = inject(SlideNavStore);
  private readonly settings = inject(ToolSettingsStore);
  private surface: InkSurface | null = null;
  private drawing: Drawing | null = null;
  private erasing: Erasing | null = null;

  /** The slide view registers itself; the returned function removes it. */
  attach(surface: InkSurface): () => void {
    this.surface = surface;
    return () => {
      this.cancel();
      if (this.surface === surface) {
        this.surface = null;
      }
    };
  }

  /** True when a stroke started; false when the gesture is to be ignored (no tool, grey outside the page, ...). ANN-010 */
  begin(client: Point, stageRect: Rect): boolean {
    this.cancel();
    const tool = this.ui.tool();
    const doc = this.session.activeDocument();
    const composition = this.surface?.composition() ?? null;
    const displayScale = this.nav.displayScale();
    if (!this.surface || !doc || doc.status() !== 'ready' || !composition || displayScale <= 0 || tool === null) {
      return false;
    }
    if (tool === 'eraser') {
      this.erasing = { doc, surface: this.surface, composition, stageRect, view: this.nav.view(), displayScale, hits: new Map() };
      doc.strokeStarted();
      this.move([client]);
      return true;
    }
    const slideSize = { width: composition.width, height: composition.height };
    const view = this.nav.view();
    const owner = startOwner(composition, clientToSlide(client, stageRect, view, displayScale, slideSize));
    const box = owner ? doc.pageInfos()[owner.pageIndex]?.box : undefined;
    if (!owner || !box) {
      return false;
    }
    const style = this.settings.style(tool);
    this.drawing = { doc, owner, box, style, surface: this.surface, stageRect, view, displayScale, slideSize, points: [] };
    doc.strokeStarted();
    this.surface.live.begin(style);
    this.move([client]);
    return true;
  }

  /** All samples since the last call (coalesced events), in order; consecutive duplicates are skipped. */
  move(clientPoints: readonly Point[]): void {
    if (this.erasing) {
      this.erase(this.erasing, clientPoints);
      return;
    }
    const drawing = this.drawing;
    if (!drawing) {
      return;
    }
    const shown: Point[] = [];
    for (const client of clientPoints) {
      const slide = clientToSlide(client, drawing.stageRect, drawing.view, drawing.displayScale, drawing.slideSize);
      const user = slidePointToUser(drawing.owner, drawing.box, slide);
      const previous = drawing.points[drawing.points.length - 1];
      if (previous === undefined || previous.x !== user.x || previous.y !== user.y) {
        drawing.points.push(user);
        shown.push(slide);
      }
    }
    drawing.surface.live.add(shown);
  }

  /** ANN-011: simplified and committed once; fewer than two distinct points make a dot. */
  end(): void {
    const erasing = this.erasing;
    if (erasing) {
      this.erasing = null;
      erasing.doc.eraseStrokes([...erasing.hits.values()]); // one undo step; nothing hit, no step
      erasing.surface.hideStrokes(new Set()); // the model is already updated, so nothing flashes back
      erasing.doc.strokeEnded();
      return;
    }
    const drawing = this.drawing;
    if (!drawing) {
      return;
    }
    this.drawing = null;
    const simplified = simplifyPath(drawing.points, TUNABLES.annotation.simplifyEpsilonPt);
    const only = simplified[0];
    const points = simplified.length < 2 && only !== undefined ? [only, { ...only }] : simplified;
    const stroke: InkStroke = { id: newStrokeId(), pageIndex: drawing.owner.pageIndex, points, ...drawing.style };
    drawing.doc.addStroke(stroke);
    drawing.surface.live.clear();
    drawing.doc.strokeEnded();
  }

  /** Pointer cancel or a second pointer: nothing is kept and no undo step is made. */
  cancel(): void {
    const erasing = this.erasing;
    if (erasing) {
      this.erasing = null;
      erasing.surface.hideStrokes(new Set());
      erasing.doc.strokeEnded();
      return;
    }
    const drawing = this.drawing;
    if (!drawing) {
      return;
    }
    this.drawing = null;
    drawing.surface.live.clear();
    drawing.doc.strokeEnded();
  }

  /**
   * ANN-005: every stroke of a page that lies within `T:annotation.eraserHitRadiusPx` (screen) of a sample, on every
   * placement of that page under the sample. Newly touched strokes disappear from the layer at once.
   */
  private erase(erasing: Erasing, clientPoints: readonly Point[]): void {
    const { doc, composition, view } = erasing;
    const slideSize = { width: composition.width, height: composition.height };
    const radiusPt = TUNABLES.annotation.eraserHitRadiusPx / (erasing.displayScale * view.zoom);
    let touched = false;
    for (const client of clientPoints) {
      const slide = clientToSlide(client, erasing.stageRect, view, erasing.displayScale, slideSize);
      for (const placement of placementsAt(composition, slide)) {
        const box = doc.pageInfos()[placement.pageIndex]?.box;
        if (!box) {
          continue;
        }
        const user = slidePointToUser(placement, box, slide);
        for (const stroke of doc.strokesOfPage(placement.pageIndex)) {
          if (!erasing.hits.has(stroke.id) && strokeHit(stroke, user, radiusPt)) {
            erasing.hits.set(stroke.id, stroke);
            touched = true;
          }
        }
      }
    }
    if (touched) {
      erasing.surface.hideStrokes(new Set(erasing.hits.keys()));
    }
  }
}
