import { ComponentFixture, TestBed } from '@angular/core/testing';

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
});
