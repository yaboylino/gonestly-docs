import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { navAreas } from '../../generated/navigation';
import { site } from '../../generated/site';
import type { PageContent } from '../content/models/page-content';
import { Icon } from '../icon/icon';
import { DocsContext } from '../language/docs-context';
import { adjacentPages } from '../navigation/util/adjacent-pages';
import { findArea } from '../navigation/util/find-area';
import { NotFound } from '../not-found/not-found';
import { Seo } from '../seo/seo';

const COPIED_RESET_MS = 1600;

/** One documentation page with its table of contents and links to the pages around it. */
@Component({
  selector: 'app-doc-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe, Icon, NotFound],
  templateUrl: './doc-page.html',
  styleUrl: './doc-page.scss',
  host: {
    '(click)': 'onClick($event)',
  },
})
export class DocPage {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly context = inject(DocsContext);
  private readonly seo = inject(Seo);
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  readonly page = input<PageContent | null>(null);
  readonly slug = input.required<string>();

  protected readonly lang = this.context.lang;
  // The HTML is rendered at build time from the Markdown in this repository, never from user input.
  protected readonly html = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(this.page()?.html ?? ''),
  );
  protected readonly area = computed(() => findArea(navAreas, this.slug()));
  protected readonly section = computed(
    () =>
      this.area().sections.find((s) => s.items.some((i) => i.slug === this.slug()))?.label ?? null,
  );
  protected readonly adjacent = computed(() => adjacentPages(this.area(), this.slug()));
  protected readonly editUrl = computed(
    () => `${site.editBaseUrl}/${this.lang()}/${this.slug()}.md`,
  );
  protected readonly activeHeading = signal<string | null>(null);

  constructor() {
    effect(() => {
      const page = this.page();
      if (!page) return;
      this.context.slug.set(page.slug);
      this.seo.update(page.title, page.description, this.lang(), page.slug);
    });

    afterRenderEffect((onCleanup) => {
      const root = this.content()?.nativeElement;
      if (!root || !this.page() || typeof IntersectionObserver === 'undefined') return;
      const headings = [...root.querySelectorAll<HTMLElement>('h2[id], h3[id]')];
      const visible = new Set<string>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target.id);
            else visible.delete(entry.target.id);
          }
          const first = headings.find((h) => visible.has(h.id));
          if (first) this.activeHeading.set(first.id);
        },
        { rootMargin: '-72px 0px -65% 0px' },
      );
      for (const heading of headings) observer.observe(heading);
      this.activeHeading.set(headings[0]?.id ?? null);
      onCleanup(() => observer.disconnect());
    });
  }

  // Links and copy buttons in the rendered Markdown are native elements; one listener handles them all.
  protected onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.content()?.nativeElement.contains(target)) return;
    const copyButton = target.closest<HTMLButtonElement>('[data-copy]');
    if (copyButton) {
      void this.copy(copyButton);
      return;
    }

    const link = target.closest<HTMLAnchorElement>('a[data-internal], a.anchor');
    if (
      !link ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    const [path, fragment] = (link.getAttribute('href') ?? '').split('#');
    void this.router.navigate(['/', this.lang(), path || this.slug()], {
      fragment: fragment || undefined,
    });
  }

  private async copy(button: HTMLButtonElement): Promise<void> {
    const code = button.parentElement?.querySelector('pre')?.textContent ?? '';
    await navigator.clipboard.writeText(code);
    const label = button.getAttribute('aria-label') ?? '';
    button.setAttribute('data-copied', '');
    button.setAttribute('aria-label', button.dataset['copiedLabel'] ?? label);
    setTimeout(() => {
      button.removeAttribute('data-copied');
      button.setAttribute('aria-label', label);
    }, COPIED_RESET_MS);
  }
}
