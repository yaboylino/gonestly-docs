import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
} from '@angular/router';
import { provideTranslateLoader, provideTranslateService } from '@ngx-translate/core';

import { defaultLanguage } from '../generated/site';
import { routes } from './app.routes';
import { BundledTranslateLoader } from './language/bundled-translate-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ paramsInheritanceStrategy: 'always' }),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideClientHydration(withEventReplay()),
    provideTranslateService({
      loader: provideTranslateLoader(BundledTranslateLoader),
      fallbackLang: defaultLanguage,
      lang: defaultLanguage,
    }),
  ],
};
