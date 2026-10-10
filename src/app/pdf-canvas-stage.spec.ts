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
