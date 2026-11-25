import type { CanMatchFn } from '@angular/router';

import { isLanguage } from './util/is-language';

/** Only matches URLs that start with a supported language. */
export const languageGuard: CanMatchFn = (_route, segments) => isLanguage(segments[0]?.path);
