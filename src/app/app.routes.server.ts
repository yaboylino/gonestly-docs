import { RenderMode, type ServerRoute } from '@angular/ssr';

import { navAreas } from '../generated/navigation';
import { defaultLanguage, languages } from '../generated/site';

const slugs = navAreas.flatMap((area) => area.sections.flatMap((s) => s.items.map((i) => i.slug)));

// The extra "404" page is copied to 404.html after the build, for static hosts.
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  {
    path: ':lang',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => languages.map((lang) => ({ lang })),
  },
  {
    path: ':lang/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => [
      ...languages.flatMap((lang) => slugs.map((slug) => ({ lang, slug }))),
      { lang: defaultLanguage, slug: '404' },
    ],
  },
  { path: '**', renderMode: RenderMode.Client },
];
