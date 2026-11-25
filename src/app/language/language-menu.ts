import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { languages } from '../../generated/site';
import { Icon } from '../icon/icon';
import { DocsContext } from './docs-context';

/** Switches the documentation to another language, staying on the same page. */
@Component({
  selector: 'app-language-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, Icon],
  templateUrl: './language-menu.html',
  styleUrl: './language-menu.scss',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close()',
  },
})
export class LanguageMenu {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly context = inject(DocsContext);

  protected readonly languages = languages;
  protected readonly lang = this.context.lang;
  protected readonly slug = this.context.slug;
  protected readonly open = signal(false);

  protected toggle(): void {
    this.open.update((open) => !open);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.element.nativeElement.contains(event.target as Node)) this.close();
  }
}
