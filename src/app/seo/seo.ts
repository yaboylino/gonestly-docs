import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import { languages, site, type LanguageCode } from '../../generated/site';

// Static hosts serve each page from a folder, so the URL with a trailing slash is the one without a redirect.
const pageUrl = (lang: LanguageCode, slug: string) => `${site.url}/${lang}/${slug}/`;

/** Keeps the title, description, canonical URL and language alternates in sync with the page. */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  update(pageTitle: string, description: string, lang: LanguageCode, slug: string | null): void {
    const fullTitle = `${pageTitle} | ${site.name}`;
    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'article' });

    for (const link of this.document.head.querySelectorAll('link[data-seo]')) link.remove();
    if (slug === null) {
      this.meta.updateTag({ name: 'robots', content: 'noindex' });
      return;
    }
    this.meta.removeTag('name="robots"');
    this.addLink({ rel: 'canonical', href: pageUrl(lang, slug) });
    for (const alternate of languages) {
      this.addLink({ rel: 'alternate', hreflang: alternate, href: pageUrl(alternate, slug) });
    }
  }

  private addLink(attributes: Record<string, string>): void {
    const link = this.document.createElement('link');
    for (const [name, value] of Object.entries(attributes)) link.setAttribute(name, value);
    link.setAttribute('data-seo', '');
    this.document.head.appendChild(link);
  }
}
