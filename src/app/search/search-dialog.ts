import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { searchLoaders } from '../../generated/pages';
import type { LanguageCode } from '../../generated/site';
import { Icon } from '../icon/icon';
import { DocsContext } from '../language/docs-context';
import type { SearchEntry } from './models/search-entry';
import type { SearchResult } from './models/search-result';
import { search } from './util/search';

/** Full-text search over every page of the current language, opened with Cmd K, Ctrl K or "/". */
@Component({
  selector: 'app-search-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Icon],
  templateUrl: './search-dialog.html',
  styleUrl: './search-dialog.scss',
  host: {
    '(click)': 'onClick($event)',
  },
})
export class SearchDialog {
  private readonly router = inject(Router);
  private readonly context = inject(DocsContext);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly indexes = new Map<LanguageCode, SearchEntry[]>();

  protected readonly query = signal('');
  protected readonly entries = signal<SearchEntry[]>([]);
  protected readonly active = signal(0);
  protected readonly results = computed<SearchResult[]>(() => search(this.entries(), this.query()));

  async open(): Promise<void> {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    this.query.set('');
    this.active.set(0);
    dialog.showModal();
    this.input().nativeElement.focus();

    const lang = this.context.lang();
    let entries = this.indexes.get(lang);
    if (!entries) {
      entries = await searchLoaders[lang]();
      this.indexes.set(lang, entries);
    }
    this.entries.set(entries);
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.results().length;
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault();
      this.active.update((i) => (i + 1) % count);
      this.scrollActiveIntoView();
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault();
      this.active.update((i) => (i - 1 + count) % count);
      this.scrollActiveIntoView();
    } else if (event.key === 'Enter') {
      const result = this.results()[this.active()];
      if (result) {
        event.preventDefault();
        this.go(result);
      }
    }
  }

  // Options are chosen with the arrow keys from the input, so clicks are handled here in one place.
  protected onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target === this.dialog().nativeElement) {
      this.close();
      return;
    }
    const index = target.closest<HTMLElement>('[data-result]')?.dataset['result'];
    const result = index === undefined ? undefined : this.results()[Number(index)];
    if (result) this.go(result);
  }

  protected go(result: SearchResult): void {
    this.close();
    void this.router.navigate(['/', this.context.lang(), result.entry.slug], {
      fragment: result.entry.id ?? undefined,
    });
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() =>
      this.dialog()
        .nativeElement.querySelector('.result.active')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
