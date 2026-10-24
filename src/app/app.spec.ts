import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { TUNABLES } from '../config/tunables';
import { APP_VERSION } from './ports/app-version';
import { APP_VERSION_RAW } from '../config/version.generated';
import { appConfig } from './app.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('I18-001 placeholder has no visible text', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main')?.textContent?.trim()).toBe('');
  });

  it('ARC-004 tunables export the canonical app identity', () => {
    expect(TUNABLES.identity.appName).toBe('CodexMusicae');
  });

  it('PIP-005 resolves the generated version through its injection token', () => {
    expect(TestBed.inject(APP_VERSION)).toBe(APP_VERSION_RAW);
  });
});
