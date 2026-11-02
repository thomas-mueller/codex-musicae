import { inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { clientToSlide, simplifyPath, slidePointToUser, startOwner } from '../core';
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
    if (!this.surface || !doc || doc.status() !== 'ready' || !composition || displayScale <= 0 || (tool !== 'pen' && tool !== 'highlighter')) {
      return false;
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
    const drawing = this.drawing;
    if (!drawing) {
      return;
    }
    this.drawing = null;
    drawing.surface.live.clear();
    drawing.doc.strokeEnded();
  }
}
