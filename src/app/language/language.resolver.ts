import { DOCUMENT, inject } from '@angular/core';
import type { ResolveFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';

import { defaultLanguage, type LanguageCode } from '../../generated/site';
import { DocsContext } from './docs-context';
import { isLanguage } from './util/is-language';

/** Loads the translations of the URL's language before the page renders. */
export const languageResolver: ResolveFn<LanguageCode> = (route) => {
  const param = route.paramMap.get('lang');
  const lang = isLanguage(param) ? param : defaultLanguage;
  inject(DocsContext).lang.set(lang);
  inject(DOCUMENT).documentElement.lang = lang;
  return inject(TranslateService)
    .use(lang)
    .pipe(map(() => lang));
};
