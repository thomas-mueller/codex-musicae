import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { TranslocoLoader, Translation } from '@jsverse/transloco';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  public getTranslation(language: string): Observable<Translation> {
    return this.http.get<Translation>(`/assets/i18n/${language}.json`);
  }
}
