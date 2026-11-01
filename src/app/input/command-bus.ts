import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import type { Observable } from 'rxjs';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Semantic commands. Raw key, wheel and pointer events become these in `input/`; nothing else reads them. DEC-022 */
export type Command =
  | { readonly type: 'Next' }
  | { readonly type: 'Previous' }
  | { readonly type: 'First' }
  | { readonly type: 'Last' }
  | { readonly type: 'ToggleMode' }
  | { readonly type: 'ExitPresentation' }
  | { readonly type: 'Back' }
  | { readonly type: 'ZoomBy'; readonly factor: number; readonly anchor: Point }
  | { readonly type: 'ZoomReset' }
  | { readonly type: 'Pan'; readonly dx: number; readonly dy: number }
  | { readonly type: 'DoubleTapZoom'; readonly anchor: Point };

/** Typed command stream; components and handlers subscribe, input sources dispatch. */
@Injectable({ providedIn: 'root' })
export class CommandBus {
  private readonly subject = new Subject<Command>();
  readonly commands$: Observable<Command> = this.subject.asObservable();

  dispatch(command: Command): void {
    this.subject.next(command);
  }
}
