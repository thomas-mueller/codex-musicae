import { App } from '@capacitor/app';

import type { BackButton } from '../../ports/back-button';

/** The part of `@capacitor/app` the adapter uses (lets unit tests inject a fake). */
export interface BackButtonApp {
  addListener(event: 'backButton', listener: () => void): unknown;
  minimizeApp(): Promise<void>;
}

interface Registration {
  readonly priority: number;
  readonly handler: () => boolean;
}

/**
 * PLT-007: handlers run from the highest priority; the first that returns true stops the chain.
 * When none handles it the app is minimized (the default Android behavior at the root).
 */
export class CapBackButton implements BackButton {
  private readonly registrations: Registration[] = [];

  constructor(private readonly app: BackButtonApp = App) {
    this.app.addListener('backButton', () => this.onBack());
  }

  register(priority: number, handler: () => boolean): () => void {
    const registration = { priority, handler };
    this.registrations.push(registration);
    this.registrations.sort((a, b) => b.priority - a.priority);
    return () => {
      const index = this.registrations.indexOf(registration);
      if (index >= 0) {
        this.registrations.splice(index, 1);
      }
    };
  }

  private onBack(): void {
    for (const { handler } of [...this.registrations]) {
      if (handler()) {
        return;
      }
    }
    void this.app.minimizeApp();
  }
}
