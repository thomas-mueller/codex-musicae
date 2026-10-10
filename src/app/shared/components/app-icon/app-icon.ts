import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AppIconName = 'arrow-left' | 'arrow-right' | 'zoom-in' | 'zoom-out' | 'presentation' | 'file-open' | 'external-link' | 'edit';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      @switch (name()) {
        @case ('arrow-left') { <path d="m15 18-6-6 6-6" /> }
        @case ('arrow-right') { <path d="m9 18 6-6-6-6" /> }
        @case ('zoom-in') { <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M11 8v6M8 11h6" /> }
        @case ('zoom-out') { <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3M8 11h6" /> }
        @case ('presentation') { <path d="M2 3h20M12 3v4M5 7h14v10H5zM8 21l4-4 4 4" /> }
        @case ('file-open') { <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /> }
        @case ('external-link') { <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /> }
        @case ('edit') { <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /> }
      }
    </svg>
  `,
  styles: [`:host { display: inline-flex; width: 1.15em; height: 1.15em; } svg { width: 100%; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppIcon {
  readonly name = input.required<AppIconName>();
}
