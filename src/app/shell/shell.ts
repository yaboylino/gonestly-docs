import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { navAreas, navLinks } from '../../generated/navigation';
import { site } from '../../generated/site';
import { Icon } from '../icon/icon';
import { DocsContext } from '../language/docs-context';
import { LanguageMenu } from '../language/language-menu';
import { findArea } from '../navigation/util/find-area';
import { SearchDialog } from '../search/search-dialog';

const TOPBAR_OFFSET = 64;

/** The application frame: top bar with search, icon rail, section sidebar and the page. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    Icon,
    LanguageMenu,
    SearchDialog,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class Shell {
  private readonly context = inject(DocsContext);
  private readonly search = viewChild.required(SearchDialog);

  protected readonly areas = navAreas;
  protected readonly links = navLinks;
  protected readonly site = site;
  protected readonly lang = this.context.lang;
  protected readonly area = computed(() => findArea(navAreas, this.context.slug()));
  protected readonly menuOpen = signal(false);
  protected readonly shortcut = signal('⌘K');

  constructor() {
    const scroller = inject(ViewportScroller);
    afterNextRender(() => {
      scroller.setOffset([0, TOPBAR_OFFSET]);
      if (!/mac|iphone|ipad/i.test(navigator.platform)) this.shortcut.set('Ctrl K');
    });
  }

  protected firstSlug(areaId: string): string {
    return navAreas.find((a) => a.id === areaId)?.sections[0]?.items[0]?.slug ?? '';
  }

  protected openSearch(): void {
    this.closeMenu();
    this.search().open();
  }

  protected openMenu(): void {
    this.menuOpen.set(true);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target?.closest('input, textarea, select, [contenteditable="true"]') !== null;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
    } else if (event.key === '/' && !typing) {
      event.preventDefault();
      this.openSearch();
    } else if (event.key === 'Escape' && this.menuOpen()) {
      this.closeMenu();
    }
  }
}
