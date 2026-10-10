import { ComponentFixture, TestBed } from '@angular/core/testing';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

import { PdfSlidesViewer } from './pdf-slides-viewer';

describe('PdfSlidesViewer', () => {
  let component: PdfSlidesViewer;
  let fixture: ComponentFixture<PdfSlidesViewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfSlidesViewer],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfSlidesViewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the current viewer aspect ratio at the default multiplier', () => {
    expect(component.aspectRatioAdjustment).toBe(0);
    expect(component.selectedAspectRatio).toBe(1.5);
    expect(component.selectedAspectRatioLabel).toBe('1.5');
  });

  it('changes the selected aspect ratio with the zoom controls', () => {
    const rebuildSlides = vi.spyOn(component as any, 'rebuildSlides').mockResolvedValue(undefined);
    const defaultRatio = component.selectedAspectRatio;
    component.zoomOut();
    expect(component.selectedAspectRatio).toBeCloseTo(defaultRatio - 0.1);
    component.zoomIn();
    expect(component.selectedAspectRatio).toBe(defaultRatio);
    expect(rebuildSlides).toHaveBeenCalledTimes(2);
  });

  it('keeps the multiplier when the viewer aspect ratio changes', () => {
    component.aspectRatioAdjustment = 0.2;
    expect(component.selectedAspectRatio).toBeCloseTo(1.7);
    component.aspectRatioAdjustment = -0.2;
    expect(component.selectedAspectRatio).toBeCloseTo(1.3);
  });

  it('disables zoom controls at their limits', () => {
    component.aspectRatioAdjustment = -1;
    expect(component.canZoomOut).toBe(false);
    expect(component.canZoomIn).toBe(true);
    component.aspectRatioAdjustment = 1.5;
    expect(component.canZoomOut).toBe(true);
    expect(component.canZoomIn).toBe(false);
  });

  it('anchors regrouped slides to the first system of the current slide', () => {
    component.slideGroups = [
      [{ pageIndex: 0, boxOrder: 1 } as never],
      [{ pageIndex: 0, boxOrder: 2 } as never],
    ];
    component.currentSlide = 1;
    const anchor = (component as any).getCurrentSlideAnchor();
    component.slideGroups = [
      [{ pageIndex: 0, boxOrder: 1 } as never, { pageIndex: 0, boxOrder: 2 } as never],
    ];
    expect((component as any).findSlideForAnchor(anchor)).toBe(0);
  });

  it('falls back to the nearest valid slide when an anchor disappears', () => {
    component.slideGroups = [[{ pageIndex: 0, boxOrder: 1 } as never]];
    component.currentSlide = 3;
    expect((component as any).findSlideForAnchor({ pageIndex: 0, boxOrder: 9 })).toBe(0);
    expect((component as any).findSlideForAnchor(undefined)).toBe(0);
  });

  it('supports first and last slide navigation', () => {
    component.slideGroups = [[{} as never], [{} as never], [{} as never]];
    component.currentSlide = 1;
    component.firstSlide();
    expect(component.currentSlide).toBe(0);
    component.lastSlide();
    expect(component.currentSlide).toBe(2);
  });

  it('advances exactly one slide through stage keyboard navigation', () => {
    component.slideGroups = [[{} as never], [{} as never], [{} as never]];
    component.currentSlide = 0;
    component.handleNavigation('next');
    expect(component.currentSlide).toBe(1);
    component.handleNavigation('previous');
    expect(component.currentSlide).toBe(0);
  });

  it('advances exactly one slide through button navigation', () => {
    component.slideGroups = [[{} as never], [{} as never], [{} as never]];
    component.currentSlide = 0;
    component.nextSlide();
    expect(component.currentSlide).toBe(1);
    component.previousSlide();
    expect(component.currentSlide).toBe(0);
  });
});
