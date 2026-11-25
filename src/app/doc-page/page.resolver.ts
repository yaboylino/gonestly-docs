import type { ResolveFn } from '@angular/router';

import { pageLoaders } from '../../generated/pages';
import type { PageContent } from '../content/models/page-content';
import { isLanguage } from '../language/util/is-language';

/** Loads the page's content, or resolves to null for a page that does not exist. */
export const pageResolver: ResolveFn<PageContent | null> = (route) => {
  const lang = route.paramMap.get('lang');
  const slug = route.paramMap.get('slug') ?? '';
  const loader = isLanguage(lang) ? pageLoaders[lang][slug] : undefined;
  return loader ? loader() : null;
};
