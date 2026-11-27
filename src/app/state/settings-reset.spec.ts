import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { ALL_FEATURES_ON } from '../../testing/provide-test-ports';
import { FEATURE_FLAGS } from '../ports/feature-flags';
import { PREFERENCES } from '../ports/preferences';
import { SettingsReset } from './settings-reset';
import { memoryPreferences } from './testing/fake-ports';
import { ToolSettingsStore } from './tool-settings.store';

describe('SettingsReset', () => {
  const kept = {
    'ratio.portrait': 1.5,
    'ratio.landscape': 2,
    'stylus.seen': true,
    'stylus.allowFinger': true,
    recent: [{ id: 'a', name: 'a.pdf' }],
    session: { tabs: [] },
  };

  it('UIX-023 resets the stored tool colors and widths, even if nothing had created the tool store before', async () => {
    const preferences = memoryPreferences({
      'tool.pen': { color: TUNABLES.colors.penPresets[1], widthIndex: 0 },
      'tool.highlighter': { color: TUNABLES.colors.highlighterPresets[1], widthIndex: 0 },
      ...kept,
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PREFERENCES, useValue: preferences },
        { provide: FEATURE_FLAGS, useValue: ALL_FEATURES_ON },
      ],
    });
    await TestBed.inject(SettingsReset).resetAll();
    const tools = TestBed.inject(ToolSettingsStore);
    expect(tools.pen()).toEqual(TUNABLES.annotation.defaultPen);
    expect(tools.highlighter()).toEqual(TUNABLES.annotation.defaultHighlighter);
    // UIX-023: aspect-ratio defaults, stylus values, recent files and the session are not reset
    expect(Object.fromEntries(preferences.data)).toEqual(kept);
  });
});
