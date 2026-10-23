import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppTranslocoLoader } from './transloco-loader';

describe('AppTranslocoLoader', () => {
  it('I18-002 loads language files from the app assets path', () => {
    TestBed.configureTestingModule({
      providers: [AppTranslocoLoader, provideHttpClient(), provideHttpClientTesting()],
    });

    const loader = TestBed.inject(AppTranslocoLoader);
    const http = TestBed.inject(HttpTestingController);
    let translation: unknown;
    loader.getTranslation('en').subscribe((value) => { translation = value; });

    const request = http.expectOne('/assets/i18n/en.json');
    expect(request.request.method).toBe('GET');
    request.flush({ app: { placeholder: '' } });
    expect(translation).toEqual({ app: { placeholder: '' } });
    http.verify();
  });
});
