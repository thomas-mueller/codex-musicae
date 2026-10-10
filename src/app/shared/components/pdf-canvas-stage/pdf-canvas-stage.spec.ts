import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PdfCanvasStage } from './pdf-canvas-stage';

@Component({
  standalone: true,
  imports: [PdfCanvasStage],
  template: `
    <app-pdf-canvas-stage [controlsVisibleInitially]="initiallyVisible">
      <div stage-content>Canvas</div>
      <div stage-controls>Controls</div>
    </app-pdf-canvas-stage>
  `,
})
class HostComponent {
  initiallyVisible = true;
}

describe('PdfCanvasStage', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('starts with the configured control visibility', () => {
    const stage = fixture.nativeElement.querySelector('app-pdf-canvas-stage');
    expect(stage.querySelector('.controls-overlay').classList.contains('controls-hidden')).toBe(false);

    const hiddenFixture = TestBed.createComponent(HostComponent);
    hiddenFixture.componentInstance.initiallyVisible = false;
    hiddenFixture.detectChanges();
    expect(hiddenFixture.nativeElement.querySelector('.controls-overlay').classList.contains('controls-hidden')).toBe(true);
  });

  it('toggles controls when the canvas area is clicked', () => {
    const overlay = fixture.nativeElement.querySelector('.controls-overlay');
    fixture.nativeElement.querySelector('.canvas-content').click();
    fixture.detectChanges();
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.classList.contains('controls-hidden')).toBe(true);

    fixture.nativeElement.querySelector('.canvas-content').click();
    fixture.detectChanges();
    expect(overlay.getAttribute('aria-hidden')).toBe('false');
    expect(overlay.classList.contains('controls-hidden')).toBe(false);
  });

  it('uses top and bottom edge bands to toggle controls and halves to navigate', () => {
    const stageElement = fixture.nativeElement.querySelector('.canvas-stage') as HTMLElement;
    const stage = fixture.debugElement.children[0].componentInstance as PdfCanvasStage;
    const navigation = vi.fn();
    stage.navigate.subscribe(navigation);
    vi.spyOn(stageElement, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600,
      x: 0, y: 0, toJSON: () => ({}),
    });

    stage.onStageClick({ target: stageElement, currentTarget: stageElement, clientX: 20, clientY: 200 } as unknown as MouseEvent);
    stage.onStageClick({ target: stageElement, currentTarget: stageElement, clientX: 380, clientY: 200 } as unknown as MouseEvent);
    expect(navigation.mock.calls).toEqual([['previous'], ['next']]);

    stage.onStageClick({ target: stageElement, currentTarget: stageElement, clientX: 200, clientY: 30 } as unknown as MouseEvent);
    expect(stage.controlsVisible()).toBe(false);
    expect(navigation).toHaveBeenCalledTimes(2);
  });

  it('maps horizontal swipes to previous and next and ignores vertical swipes', () => {
    const stage = fixture.debugElement.children[0].componentInstance as PdfCanvasStage;
    const navigation = vi.fn();
    stage.navigate.subscribe(navigation);
    const pointer = (type: string, x: number, y: number) => new PointerEvent(type, {
      pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true,
      cancelable: true,
    });

    stage.onPointerDown(pointer('pointerdown', 300, 200));
    stage.onPointerUp(pointer('pointerup', 220, 205));
    stage.onPointerDown(pointer('pointerdown', 100, 200));
    stage.onPointerUp(pointer('pointerup', 180, 205));
    stage.onPointerDown(pointer('pointerdown', 100, 100));
    stage.onPointerUp(pointer('pointerup', 105, 200));
    expect(navigation.mock.calls).toEqual([['next'], ['previous']]);
  });

  it('does not toggle when a control is clicked', () => {
    const controls = fixture.nativeElement.querySelector('[stage-controls]') as HTMLElement;
    controls.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.controls-overlay').classList.contains('controls-hidden')).toBe(false);
  });

  it('toggles with C and ignores editable fields', () => {
    const stage = fixture.debugElement.children[0].componentInstance as PdfCanvasStage;
    stage.onToggleShortcut(new KeyboardEvent('keydown', { key: 'c' }));
    expect(stage.controlsVisible()).toBe(false);

    const input = document.createElement('input');
    const typingEvent = new KeyboardEvent('keydown', { key: 'c', bubbles: true });
    input.dispatchEvent(typingEvent);
    Object.defineProperty(typingEvent, 'target', { value: input });
    stage.onToggleShortcut(typingEvent);
    expect(stage.controlsVisible()).toBe(false);
  });

  it('maps navigation keys and prevents their browser defaults', () => {
    const stage = fixture.debugElement.children[0].componentInstance as PdfCanvasStage;
    const navigation = vi.fn();
    stage.navigate.subscribe(navigation);
    for (const key of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true });
      stage.onToggleShortcut(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(navigation.mock.calls).toEqual([
      ['previous'], ['previous'], ['previous'], ['previous'],
      ['next'], ['next'], ['next'], ['next'], ['first'], ['last'],
    ]);
  });

  it('hides controls on Escape and emits when already hidden', () => {
    const stage = fixture.debugElement.children[0].componentInstance as PdfCanvasStage;
    const escape = new Event('keydown');
    const hiddenEscape = vi.fn();
    stage.escapeWhileHidden.subscribe(hiddenEscape);

    stage.onEscape(escape);
    expect(stage.controlsVisible()).toBe(false);
    stage.onEscape(escape);
    expect(hiddenEscape).toHaveBeenCalledOnce();
  });
});
