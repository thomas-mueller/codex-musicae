import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfEditor } from './pdf-editor';

describe('PdfEditor', () => {
  let component: PdfEditor;
  let fixture: ComponentFixture<PdfEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfEditor);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
