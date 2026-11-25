import { Injectable } from '@angular/core';
import { TranslateLoader, type TranslationObject } from '@ngx-translate/core';
import { from, type Observable } from 'rxjs';

import type { LanguageCode } from '../../generated/site';

const translations: Record<LanguageCode, () => Promise<TranslationObject>> = {
  en: () => import('../../i18n/en.json').then((m) => m.default),
  nl: () => import('../../i18n/nl.json').then((m) => m.default),
};

/** Bundles each language as a lazy chunk, so translations load the same way when prerendering. */
@Injectable()
export class BundledTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return from(translations[lang as LanguageCode]());
  }
}
