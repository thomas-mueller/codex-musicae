import { inject, Injectable, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { FEATURE_FLAGS } from '../ports/feature-flags';
import type { FeatureFlags } from '../ports/feature-flags';
import { PREFERENCES } from '../ports/preferences';

/** The groups of the settings mode, in display order. UIX-026 */
export const SETTINGS_GROUPS = ['general', 'display', 'slideMode', 'files'] as const;
type SettingsGroup = (typeof SETTINGS_GROUPS)[number];

type SettingValue = boolean | string | number;

interface BaseDefinition {
  /** Unique; also the preference key (`setting.<id>`). */
  readonly id: string;
  readonly group: SettingsGroup;
  /** Translation key of the visible text. */
  readonly labelKey: string;
  /** The feature switch the setting depends on: while it is off the setting is disabled and keeps its default. */
  readonly feature?: keyof FeatureFlags;
  /** Whether the value is stored; the persistence switches decide whether the build really stores it (EDN-005). */
  readonly persist: boolean;
}

interface BooleanDefinition extends BaseDefinition {
  readonly type: 'boolean';
  readonly defaultValue: boolean;
}

interface ChoiceDefinition extends BaseDefinition {
  readonly type: 'choice';
  readonly defaultValue: string;
  readonly options: readonly { readonly value: string; readonly labelKey: string }[];
}

/** A duration; the limits come from the registrant (tunables). */
interface SecondsDefinition extends BaseDefinition {
  readonly type: 'seconds';
  readonly defaultValue: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export type SettingDefinition = BooleanDefinition | ChoiceDefinition | SecondsDefinition;

type ValueOf<D extends SettingDefinition> = D extends BooleanDefinition ? boolean : D extends SecondsDefinition ? number : string;

/** A registered setting: what the view renders and what the owner of the setting reads. */
export interface Setting<V extends SettingValue = SettingValue> {
  readonly definition: SettingDefinition;
  readonly enabled: boolean;
  readonly value: Signal<V>;
  /** Invalid values, and every value while the setting is disabled, are ignored. */
  set(value: SettingValue): Promise<void>;
  /** Resolves when the stored value has been read (and queued changes are written). */
  readonly ready: Promise<void>;
}

const KEY_PREFIX = 'setting.';

function isValid(definition: SettingDefinition, value: unknown): value is SettingValue {
  switch (definition.type) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'choice':
      return definition.options.some((option) => option.value === value);
    case 'seconds':
      return typeof value === 'number' && Number.isFinite(value) && value >= definition.min && value <= definition.max;
  }
}

/**
 * Every user setting is registered here by the code that owns it; the settings view renders the entries and knows no
 * setting itself. "Reset all settings" runs every registered reset handler. UIX-021, UIX-023, UIX-026
 */
@Injectable({ providedIn: 'root' })
export class SettingsRegistry {
  private readonly preferences = inject(PREFERENCES);
  private readonly flags = inject(FEATURE_FLAGS);
  private readonly entriesSignal = signal<readonly Setting[]>([]);
  private readonly resetHandlers: (() => Promise<void>)[] = [];

  /** In registration order. */
  readonly entries = this.entriesSignal.asReadonly();

  register<D extends SettingDefinition>(definition: D): Setting<ValueOf<D>> {
    if (this.entriesSignal().some((entry) => entry.definition.id === definition.id)) {
      throw new Error(`setting ${definition.id} is registered twice`);
    }
    const { setting, reset } = this.create(definition);
    this.registerReset(reset);
    this.entriesSignal.update((entries) => [...entries, setting]);
    return setting as Setting<ValueOf<D>>;
  }

  /**
   * For user state that is not a registered setting. A handler only runs when it was registered before the user resets:
   * whoever owns such state must be created by then.
   */
  registerReset(handler: () => Promise<void>): void {
    this.resetHandlers.push(handler);
  }

  /** UIX-023: runs every handler; one that fails does not stop the others. */
  async resetAll(): Promise<void> {
    await Promise.allSettled(this.resetHandlers.map(async (handler) => handler()));
  }

  private create(definition: SettingDefinition): { readonly setting: Setting; readonly reset: () => Promise<void> } {
    const enabled = definition.feature === undefined || this.flags[definition.feature] === true;
    const stored = enabled && definition.persist;
    const key = KEY_PREFIX + definition.id;
    const value = signal<SettingValue>(definition.defaultValue);
    let changed = false;
    let pending = stored
      ? this.preferences.get<unknown>(key).then((saved) => {
          // A change the user made while the read was running wins.
          if (!changed && isValid(definition, saved)) {
            value.set(saved);
          }
        })
      : Promise.resolve();
    /** Takes the new value at once (also over a read still running) and queues the change of the store. */
    const apply = (next: SettingValue, write: () => Promise<void>): Promise<void> => {
      changed = true;
      value.set(next);
      if (stored) {
        pending = pending.then(write, write);
      }
      return pending;
    };
    const setting: Setting = {
      definition,
      enabled,
      value: value.asReadonly(),
      set: (next) => (enabled && isValid(definition, next) ? apply(next, () => this.preferences.set(key, next)) : pending),
      get ready() {
        return pending;
      },
    };
    // The key is removed, not overwritten with the default, so a later change of the default applies.
    const reset = (): Promise<void> => (enabled ? apply(definition.defaultValue, () => this.preferences.remove(key)) : pending);
    return { setting, reset };
  }
}
