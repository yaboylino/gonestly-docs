import type { Routes } from '@angular/router';

import { defaultLanguage } from '../generated/site';
import { DocPage } from './doc-page/doc-page';
import { pageResolver } from './doc-page/page.resolver';
import { languageGuard } from './language/language.guard';
import { languageResolver } from './language/language.resolver';
import { NotFound } from './not-found/not-found';
import { Shell } from './shell/shell';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: defaultLanguage },
  {
    path: ':lang',
    canMatch: [languageGuard],
    resolve: { language: languageResolver },
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'introduction' },
      { path: ':slug', component: DocPage, resolve: { page: pageResolver } },
    ],
  },
  {
    path: '',
    resolve: { language: languageResolver },
    component: Shell,
    children: [{ path: '**', component: NotFound }],
  },
];
