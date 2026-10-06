import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import * as pdfjsLib from 'pdfjs-dist';
import { PdfEditor } from './pdf-editor';

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

describe('PdfEditor', () => {
  let component: PdfEditor;
  let fixture: ComponentFixture<PdfEditor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfEditor],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfEditor);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('disables page navigation at the document boundaries', () => {
    component.pageCount = 2;
    component.currentPage = 1;
    expect(component.canGoToPreviousPage).toBe(false);
    expect(component.canGoToNextPage).toBe(true);

    component.currentPage = 2;
    expect(component.canGoToPreviousPage).toBe(true);
    expect(component.canGoToNextPage).toBe(false);
  });

  it('shows a page error when rendering fails', async () => {
    const page = {
      getViewport: vi.fn(() => ({ width: 100, height: 100 })),
      render: vi.fn(() => ({
        promise: Promise.reject(new Error('render failed')),
        cancel: vi.fn(),
      })),
    };
    const document = { getPage: vi.fn().mockResolvedValue(page) };
    const canvas = {
      width: 0,
      height: 0,
      style: {},
      getContext: vi.fn(() => ({})),
    };

    (component as any).pdfDocument = document;
    (component as any).pdfViewportRef = { nativeElement: { clientWidth: 500, clientHeight: 500 } };
    (component as any).canvasRef = { nativeElement: canvas };

    await (component as any).renderCurrentPage();

    expect(component.errorMessage).toBe('Unable to render this PDF page.');
  });

  it('shows a load error when the PDF cannot be opened', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe(): void {}
      disconnect(): void {}
    });
    (component as any).pdfViewportRef = {
      nativeElement: { clientWidth: 500, clientHeight: 500 },
    };
    vi.mocked(pdfjsLib.getDocument).mockReturnValue({
      promise: Promise.reject(new Error('load failed')),
      destroy: vi.fn(),
    } as never);

    await component.ngAfterViewInit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Unable to load this PDF.');
    vi.unstubAllGlobals();
  });
});
