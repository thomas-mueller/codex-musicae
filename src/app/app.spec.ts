import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { TUNABLES } from '../config/tunables';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
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
});
