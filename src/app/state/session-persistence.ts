import { computed, effect, inject, Injectable, untracked } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import type { SessionSnapshot, TabSnapshot } from '../core';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { PREFERENCES } from '../ports/preferences';
import { CLOCK } from './clock';
import { OrgViewStore } from './org-view.store';
import { SessionStore } from './session.store';

const NO_ORG_POSITION = { page: 0, offset: 0 } as const;

/**
 * FIL-011, FIL-014, NFR-015: writes the open tabs and their positions to the preferences store `T:persistence.sessionDebounceMs`
 * after any change, and at once when the app is paused or hidden (the WebView may be killed after that). Nothing is written
 * before `SessionStore.restore()` has finished, so an empty startup state never replaces the stored session.
 */
@Injectable({ providedIn: 'root' })
export class SessionPersistence {
  private readonly session = inject(SessionStore);
  private readonly orgView = inject(OrgViewStore);
  private readonly prefs = inject(PREFERENCES);
  private readonly clock = inject(CLOCK);
  private cancelTimer: (() => void) | null = null;

  /** Plain data: file references (never bytes) and positions. */
  readonly snapshot = computed<SessionSnapshot>(() => {
    const entries = this.session.sessionEntries();
    const tabs: TabSnapshot[] = entries.map(({ ref, document, pendingSystem }) => {
      const org = document.orgRestore() ?? this.orgView.anchorOf(document) ?? NO_ORG_POSITION;
      return { ref, system: pendingSystem ?? document.position().system, orgPage: org.page, orgOffset: org.offset };
    });
    const activeId = this.session.activeTabId();
    const activeIndex = Math.max(0, this.session.tabs().findIndex((tab) => tab.id === activeId));
    return { version: 1, tabs, activeIndex };
  });

  constructor() {
    inject(APP_LIFECYCLE).onPause(() => this.flush());
    effect(() => {
      this.snapshot();
      if (this.session.restored()) {
        untracked(() => this.schedule());
      }
    });
  }

  private schedule(): void {
    this.cancelTimer?.();
    this.cancelTimer = this.clock.schedule(TUNABLES.persistence.sessionDebounceMs, () => {
      this.cancelTimer = null;
      void this.write();
    });
  }

  /** Writes the current snapshot now (pause, hide). */
  flush(): Promise<void> {
    if (!this.session.restored()) {
      return Promise.resolve();
    }
    this.cancelTimer?.();
    this.cancelTimer = null;
    return this.write();
  }

  private async write(): Promise<void> {
    try {
      await this.prefs.set(TUNABLES.persistence.sessionKey, this.snapshot());
    } catch {
      // The next change writes again; losing one snapshot only loses the position.
    }
  }
}
