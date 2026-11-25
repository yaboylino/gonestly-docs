import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

import { icons, type IconName } from '../../generated/icons';

/** Renders a Phosphor icon that inherits the text color and font size. */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: {
    'aria-hidden': 'true',
    '[innerHTML]': 'svg()',
  },
  styles: `
    :host {
      display: inline-flex;
      width: 1em;
      height: 1em;
      flex: none;
    }
  `,
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();

  // The markup comes from the Phosphor package at build time, never from user input.
  protected readonly svg = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      `<svg viewBox="0 0 256 256" fill="currentColor">${icons[this.name()]}</svg>`,
    ),
  );
}
