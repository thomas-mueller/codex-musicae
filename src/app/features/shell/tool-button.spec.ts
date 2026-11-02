import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { UiStore } from '../../state/ui.store';
import { TOOL_ENTRIES } from './tool-area';
import { POPUP_TOOL_SETTINGS, ToolButton } from './tool-button';

const entryOf = (tool: 'pen' | 'highlighter' | 'eraser') => TOOL_ENTRIES.find((e) => e.tool === tool)!;

describe('ToolButton', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] }));
  afterEach(() => vi.useRealTimers());

  async function setup(tool: 'pen' | 'highlighter' | 'eraser', panel = false) {
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    const fixture = TestBed.createComponent(ToolButton);
    fixture.componentRef.setInput('entry', entryOf(tool));
    fixture.componentRef.setInput('panel', panel);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const main = () => root.querySelector('button') as HTMLButtonElement;
    const affordance = () => root.querySelector('.affordance');
    const settle = () => fixture.whenStable();
    return { ui, fixture, root, main, affordance, settle };
  }

  /** Fake timers only while holding: the zoneless stability check needs real ones. */
  async function longPress(button: HTMLElement, settle: () => Promise<unknown>) {
    vi.useFakeTimers();
    button.dispatchEvent(new PointerEvent('pointerdown', { clientX: 5, clientY: 5, bubbles: true }));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    vi.useRealTimers();
    button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    button.click(); // the browser's click after the release
    await settle();
  }

  it('ANN-001 the active tool has the toggled look; ANN-002 tapping toggles it', async () => {
    const { ui, main, settle } = await setup('pen');
    main().click();
    await settle();
    expect(ui.tool()).toBe('pen');
    expect(main().classList.contains('toggled')).toBe(true);
    main().click();
    await settle();
    expect(ui.tool()).toBeNull();
    expect(main().classList.contains('toggled')).toBe(false);
  });

  it('ANN-002 the settings affordance exists on the active pen only', async () => {
    const { ui, affordance, settle } = await setup('pen');
    expect(affordance()).toBeNull();
    ui.setTool('pen');
    await settle();
    expect(affordance()).not.toBeNull();
    ui.setTool('highlighter');
    await settle();
    expect(affordance()).toBeNull();
  });

  it('ANN-002 the affordance opens and closes the settings popup', async () => {
    const { ui, affordance, settle } = await setup('highlighter');
    ui.setTool('highlighter');
    await settle();
    (affordance() as HTMLButtonElement).click();
    expect(ui.popup()?.id).toBe(POPUP_TOOL_SETTINGS);
    (affordance() as HTMLButtonElement).click();
    expect(ui.popup()).toBeNull();
  });

  it('ANN-002 a long press activates the tool and opens the settings, and the trailing click does not toggle it off', async () => {
    const { ui, main, settle } = await setup('pen');
    await longPress(main(), settle);
    expect(ui.tool()).toBe('pen');
    expect(ui.popup()?.id).toBe(POPUP_TOOL_SETTINGS);
  });

  it('ANN-002 a long press on the active tool keeps it active', async () => {
    const { ui, main, settle } = await setup('highlighter');
    ui.setTool('highlighter');
    await longPress(main(), settle);
    expect(ui.tool()).toBe('highlighter');
    expect(ui.popup()?.id).toBe(POPUP_TOOL_SETTINGS);
  });

  it('ANN-002 the eraser has no popup and no affordance; it just toggles', async () => {
    const { ui, root, main, affordance, settle } = await setup('eraser');
    ui.setTool('eraser');
    await settle();
    expect(affordance()).toBeNull();
    main().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    main().click();
    await settle();
    expect(ui.popup()).toBeNull();
    expect(ui.tool()).toBeNull();
    expect(root.querySelector('app-tool-popup')).toBeNull();
  });

  it('ANN-004 in the expanded strip the popup opens beside the button', async () => {
    const { ui, root, settle } = await setup('pen', true);
    ui.setTool('pen');
    ui.openPopup(POPUP_TOOL_SETTINGS);
    await settle();
    expect(root.querySelector('.side-panel app-tool-popup')).not.toBeNull();
  });
});
