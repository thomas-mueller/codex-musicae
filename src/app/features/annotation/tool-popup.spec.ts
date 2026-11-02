import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { PREFERENCES } from '../../ports/preferences';
import { memoryPreferences } from '../../state/testing/fake-ports';
import { ToolSettingsStore } from '../../state/tool-settings.store';
import { ToolPopup } from './tool-popup';

describe('ToolPopup', () => {
  async function setup(tool: 'pen' | 'highlighter') {
    const preferences = memoryPreferences();
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: PREFERENCES, useValue: preferences }],
    });
    const settings = TestBed.inject(ToolSettingsStore);
    await settings.ready;
    const fixture = TestBed.createComponent(ToolPopup);
    fixture.componentRef.setInput('tool', tool);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, root, settings, preferences };
  }

  it('ANN-004 shows 6 colors and 3 widths for the pen and the highlighter', async () => {
    for (const tool of ['pen', 'highlighter'] as const) {
      TestBed.resetTestingModule();
      const { root } = await setup(tool);
      expect(root.querySelectorAll('.swatch')).toHaveLength(6);
      expect(root.querySelectorAll('.sample')).toHaveLength(3);
    }
  });

  it('ANN-004 the selected color and width are marked toggled', async () => {
    const { root } = await setup('pen');
    const swatches = [...root.querySelectorAll<HTMLElement>('.swatch')];
    const samples = [...root.querySelectorAll<HTMLElement>('.sample')];
    expect(swatches.map((e) => e.classList.contains('toggled'))).toEqual(
      TUNABLES.colors.penPresets.map((c) => c === TUNABLES.annotation.defaultPen.color),
    );
    expect(samples.map((e) => e.classList.contains('toggled'))).toEqual(
      TUNABLES.annotation.penWidthsPt.map((_, i) => i === TUNABLES.annotation.defaultPen.widthIndex),
    );
  });

  it('ANN-003 picking a color and a width applies at once and is persisted', async () => {
    const { fixture, root, settings, preferences } = await setup('highlighter');
    (root.querySelectorAll('.swatch')[3] as HTMLButtonElement).click();
    (root.querySelectorAll('.sample')[0] as HTMLButtonElement).click();
    await fixture.whenStable();
    await settings.ready;
    expect(settings.highlighter()).toEqual({ color: TUNABLES.colors.highlighterPresets[3], widthIndex: 0 });
    expect(preferences.data.get('tool.highlighter')).toEqual({ color: TUNABLES.colors.highlighterPresets[3], widthIndex: 0 });
    expect(root.querySelectorAll('.swatch')[3]?.classList.contains('toggled')).toBe(true);
  });

  it('ANN-004 width samples are lines of the configured widths', async () => {
    const { root } = await setup('pen');
    const heights = [...root.querySelectorAll<HTMLElement>('.line')].map((e) => e.style.height);
    expect(heights).toEqual(TUNABLES.annotation.penWidthsPt.map((w) => `${w}px`));
  });
});
