import { Injectable, signal } from '@angular/core';

import { defaultLanguage, type LanguageCode } from '../../generated/site';

/** The language and page the reader is on, shared by the shell and the page. */
@Injectable({ providedIn: 'root' })
export class DocsContext {
  readonly lang = signal<LanguageCode>(defaultLanguage);
  readonly slug = signal<string | null>(null);
}
