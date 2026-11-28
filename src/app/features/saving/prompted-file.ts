import { computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import { SessionStore } from '../../state/session.store';

/** The name of the file a question or notice is about. Call in an injection context. */
export function fileName(tabId: () => string | null): Signal<string> {
  const session = inject(SessionStore);
  return computed(() => session.tabs().find((tab) => tab.id === tabId())?.name ?? '');
}
