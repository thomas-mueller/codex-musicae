import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit, OnDestroy {
  protected readonly title = signal('codex-musicae');

  constructor(private router: Router) {}

  private backButtonListener?: { remove: () => Promise<void> };

  ngOnInit() {
    void App.addListener('backButton', () => {
      if (this.router.url === '/viewer') {
        this.router.navigate(['/editor']);
      } else {
        App.exitApp();
      }
    }).then((listener) => { this.backButtonListener = listener; });
  }

  ngOnDestroy() {
    void this.backButtonListener?.remove();
  }
}
