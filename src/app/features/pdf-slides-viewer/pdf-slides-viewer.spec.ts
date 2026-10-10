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
