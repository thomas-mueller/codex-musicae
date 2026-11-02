import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { PREFERENCES } from '../ports/preferences';
import { memoryPreferences } from './testing/fake-ports';
import { ToolSettingsStore } from './tool-settings.store';

async function setup(initial: Record<string, unknown> = {}) {
  const preferences = memoryPreferences(initial);
  TestBed.configureTestingModule({ providers: [{ provide: PREFERENCES, useValue: preferences }] });
  const store = TestBed.inject(ToolSettingsStore);
  await store.ready;
  return { store, preferences };
}

describe('ToolSettingsStore', () => {
  it('ANN-003 starts with the tunable defaults', async () => {
    const { store } = await setup();
    expect(store.pen()).toEqual(TUNABLES.annotation.defaultPen);
    expect(store.highlighter()).toEqual(TUNABLES.annotation.defaultHighlighter);
  });

  it('ANN-004 offers 6 colors and 3 widths per tool', () => {
    expect(TUNABLES.colors.penPresets).toHaveLength(6);
    expect(TUNABLES.colors.highlighterPresets).toHaveLength(6);
    expect(TUNABLES.annotation.penWidthsPt).toHaveLength(3);
    expect(TUNABLES.annotation.highlighterWidthsPt).toHaveLength(3);
  });

  it('ANN-003 changes apply at once and are persisted under tool.pen / tool.highlighter', async () => {
    const { store, preferences } = await setup();
    const color = TUNABLES.colors.penPresets[1] as string;
    const pending = store.setColor('pen', color);
    expect(store.pen().color).toBe(color);
    await pending;
    await store.setWidthIndex('highlighter', 0);
    expect(preferences.data.get('tool.pen')).toEqual({ color, widthIndex: TUNABLES.annotation.defaultPen.widthIndex });
    expect(preferences.data.get('tool.highlighter')).toEqual({ color: TUNABLES.annotation.defaultHighlighter.color, widthIndex: 0 });
  });

  it('ANN-003 stored settings are restored by a new store', async () => {
    const color = TUNABLES.colors.highlighterPresets[2] as string;
    const { store } = await setup({ 'tool.highlighter': { color, widthIndex: 2 } });
    expect(store.highlighter()).toEqual({ color, widthIndex: 2 });
  });

  it('ANN-003 invalid stored values fall back to the default per field', async () => {
    const { store } = await setup({
      'tool.pen': { color: '#123456', widthIndex: 1 },
      'tool.highlighter': { color: TUNABLES.colors.highlighterPresets[1], widthIndex: 3 },
    });
    expect(store.pen()).toEqual({ color: TUNABLES.annotation.defaultPen.color, widthIndex: 1 });
    expect(store.highlighter()).toEqual({ color: TUNABLES.colors.highlighterPresets[1], widthIndex: TUNABLES.annotation.defaultHighlighter.widthIndex });
  });

  it('ANN-003 garbage stored values (wrong types) fall back to the defaults', async () => {
    const { store } = await setup({ 'tool.pen': 'red', 'tool.highlighter': { color: 7, widthIndex: 1.5 } });
    expect(store.pen()).toEqual(TUNABLES.annotation.defaultPen);
    expect(store.highlighter()).toEqual(TUNABLES.annotation.defaultHighlighter);
  });

  it('ANN-004 refuses colors that are no preset and widths out of range', async () => {
    const { store, preferences } = await setup();
    await store.setColor('pen', '#123456');
    await store.setWidthIndex('pen', TUNABLES.annotation.penWidthsPt.length);
    await store.setWidthIndex('pen', -1);
    expect(store.pen()).toEqual(TUNABLES.annotation.defaultPen);
    expect(preferences.data.has('tool.pen')).toBe(false);
  });

  it('ANN-004 the pen is opaque and the highlighter uses the configured opacity with multiply', async () => {
    const { store } = await setup();
    expect(store.style('pen')).toEqual({
      color: TUNABLES.annotation.defaultPen.color,
      widthPt: TUNABLES.annotation.penWidthsPt[TUNABLES.annotation.defaultPen.widthIndex],
      opacity: 1,
      multiply: false,
    });
    expect(store.style('highlighter')).toEqual({
      color: TUNABLES.annotation.defaultHighlighter.color,
      widthPt: TUNABLES.annotation.highlighterWidthsPt[TUNABLES.annotation.defaultHighlighter.widthIndex],
      opacity: TUNABLES.annotation.highlighterOpacity,
      multiply: true,
    });
  });
});
