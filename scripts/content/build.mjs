import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMarkdownRenderer, parseFrontMatter, searchSections } from './markdown.mjs';
import { DASHES, collectKeys, validateTranslations } from './validate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const contentDir = path.join(root, 'content');
const i18nDir = path.join(root, 'src/i18n');
const outDir = path.join(root, 'src/generated');
const iconsDir = path.join(root, 'node_modules/@phosphor-icons/core/assets');

// Icons the interface uses besides the ones named in the navigation.
const UI_ICONS = [
  'bird-fill',
  'magnifying-glass',
  'list',
  'question',
  'x',
  'copy',
  'check',
  'arrow-left',
  'arrow-right',
  'pencil-simple',
  'arrow-square-out',
  'caret-right',
  'translate',
];

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const ts = (value) => JSON.stringify(value, null, 2);

async function build() {
  const site = await readJson(path.join(contentDir, 'site.json'));
  const navigation = await readJson(path.join(contentDir, 'navigation.json'));
  const translations = Object.fromEntries(
    await Promise.all(
      site.languages.map(async (lang) => [
        lang,
        await readJson(path.join(i18nDir, `${lang}.json`)),
      ]),
    ),
  );

  const problems = [];
  const slugs = navigation.areas.flatMap((area) =>
    area.sections.flatMap((s) => s.items.map((i) => i.slug)),
  );
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  for (const slug of duplicates)
    problems.push(`navigation.json: the page "${slug}" appears more than once`);

  problems.push(...validateTranslations(translations, site.defaultLanguage));
  const keys = collectKeys(translations[site.defaultLanguage]);
  const usedKeys = [
    ...navigation.areas.flatMap((a) => [
      a.label,
      ...a.sections.flatMap((s) => [s.label, ...s.items.map((i) => i.label)]),
    ]),
    ...navigation.links.map((l) => l.label),
    ...site.languages.map((lang) => `language.names.${lang}`),
  ];
  for (const key of usedKeys) {
    if (!keys.has(key))
      problems.push(`navigation.json: the translation key "${key}" does not exist`);
  }

  const icons = new Set([
    ...UI_ICONS,
    ...navigation.areas.flatMap((a) => [
      a.icon,
      ...a.sections.flatMap((s) => s.items.map((i) => i.icon)),
    ]),
    ...navigation.links.map((l) => l.icon),
  ]);
  const iconSvgs = {};
  for (const icon of icons) {
    const weight = icon.endsWith('-fill') ? 'fill' : 'regular';
    const file = path.join(iconsDir, weight, `${icon}.svg`);
    if (!existsSync(file)) {
      problems.push(`the icon "${icon}" does not exist in Phosphor`);
      continue;
    }
    const svg = await readFile(file, 'utf8');
    iconSvgs[icon] = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  }

  const render = await createMarkdownRenderer(iconSvgs);
  const pages = {};
  for (const lang of site.languages) {
    pages[lang] = {};
    const dir = path.join(contentDir, lang);
    const files = existsSync(dir) ? (await readdir(dir)).filter((f) => f.endsWith('.md')) : [];
    for (const file of files) {
      const slug = file.replace(/\.md$/, '');
      const relative = `content/${lang}/${file}`;
      if (!slugs.includes(slug)) {
        problems.push(`${relative}: the page is not in navigation.json`);
        continue;
      }
      try {
        const { data, body } = parseFrontMatter(
          await readFile(path.join(dir, file), 'utf8'),
          relative,
        );
        if (DASHES.test(body.replace(/```[\s\S]*?```/g, ''))) {
          problems.push(
            `${relative}: replace the em or en dash with a comma, colon, period or parentheses`,
          );
        }
        const { copy, copied } = translations[lang].page;
        const result = render(body, { lang, file: relative, copyLabel: copy, copiedLabel: copied });
        problems.push(...result.problems);
        pages[lang][slug] = {
          slug,
          file: relative,
          title: data.title,
          description: data.description,
          ...result,
        };
      } catch (error) {
        problems.push(error.message);
      }
    }
    for (const slug of slugs) {
      if (!pages[lang][slug] && !problems.some((p) => p.includes(`content/${lang}/${slug}.md`))) {
        problems.push(`content/${lang}/${slug}.md: the page is missing in "${lang}"`);
      }
    }
  }

  for (const lang of site.languages) {
    for (const page of Object.values(pages[lang])) {
      for (const link of page.links) {
        const [target, fragment] = link.split('#');
        const targetPage = target ? pages[lang][target] : page;
        if (target && !slugs.includes(target)) {
          problems.push(`${page.file}: the link "${link}" points to a page that does not exist`);
        } else if (fragment && targetPage && !targetPage.headings.some((h) => h.id === fragment)) {
          problems.push(`${page.file}: the link "${link}" points to a heading that does not exist`);
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `The documentation has ${problems.length} problem(s):\n  - ${problems.join('\n  - ')}`,
    );
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeGenerated(site, navigation, pages, iconSvgs);
  return Object.values(pages).reduce((n, p) => n + Object.keys(p).length, 0);
}

async function writeGenerated(site, navigation, pages, iconSvgs) {
  const header = '// Generated by scripts/content/build.mjs; do not edit.\n';
  const write = async (file, content) => {
    await mkdir(path.dirname(path.join(outDir, file)), { recursive: true });
    await writeFile(path.join(outDir, file), content);
  };

  for (const [lang, langPages] of Object.entries(pages)) {
    for (const page of Object.values(langPages)) {
      const content = {
        slug: page.slug,
        title: page.title,
        description: page.description,
        html: page.html,
        headings: page.headings,
      };
      await write(
        `content/${lang}/${page.slug}.ts`,
        `${header}import type { PageContent } from '../../../app/content/models/page-content';\n\nexport default ${ts(content)} satisfies PageContent;\n`,
      );
    }
    const entries = Object.values(langPages).flatMap((page) =>
      searchSections(page.html).map((section) => ({
        slug: page.slug,
        title: page.title,
        ...section,
      })),
    );
    await write(
      `search/${lang}.ts`,
      `${header}import type { SearchEntry } from '../../app/search/models/search-entry';\n\nexport default ${ts(entries)} satisfies SearchEntry[];\n`,
    );
  }

  const languages = site.languages.map((l) => `'${l}'`).join(' | ');
  await write(
    'site.ts',
    `${header}export type LanguageCode = ${languages};\n\nexport const site = ${ts({ ...site, languages: undefined, defaultLanguage: undefined })} as const;\n\nexport const languages: readonly LanguageCode[] = ${ts(site.languages)};\n\nexport const defaultLanguage: LanguageCode = '${site.defaultLanguage}';\n`,
  );

  const loaders = Object.entries(pages)
    .map(([lang, langPages]) => {
      const entries = Object.keys(langPages)
        .map(
          (slug) =>
            `    '${slug}': () => import('./content/${lang}/${slug}').then((m) => m.default),`,
        )
        .join('\n');
      return `  ${lang}: {\n${entries}\n  },`;
    })
    .join('\n');
  const searchLoaders = Object.keys(pages)
    .map((lang) => `  ${lang}: () => import('./search/${lang}').then((m) => m.default),`)
    .join('\n');
  await write(
    'pages.ts',
    `${header}import type { PageContent } from '../app/content/models/page-content';\nimport type { SearchEntry } from '../app/search/models/search-entry';\nimport type { LanguageCode } from './site';\n\nexport const pageLoaders: Record<LanguageCode, Record<string, () => Promise<PageContent>>> = {\n${loaders}\n};\n\nexport const searchLoaders: Record<LanguageCode, () => Promise<SearchEntry[]>> = {\n${searchLoaders}\n};\n`,
  );

  await write(
    'navigation.ts',
    `${header}import type { NavArea } from '../app/navigation/models/nav-area';\nimport type { NavLink } from '../app/navigation/models/nav-link';\n\nexport const navAreas: NavArea[] = ${ts(navigation.areas)};\n\nexport const navLinks: NavLink[] = ${ts(navigation.links)};\n`,
  );

  const iconNames = Object.keys(iconSvgs).sort();
  await write(
    'icons.ts',
    `${header}export type IconName =\n${iconNames.map((n) => `  | '${n}'`).join('\n')};\n\nexport const icons: Record<IconName, string> = ${ts(Object.fromEntries(iconNames.map((n) => [n, iconSvgs[n]])))};\n`,
  );

  const urls = Object.entries(pages).flatMap(([lang, langPages]) =>
    Object.keys(langPages).map((slug) => {
      const alternates = site.languages
        .map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${l}" href="${site.url}/${l}/${slug}"/>`,
        )
        .join('\n');
      return `  <url>\n    <loc>${site.url}/${lang}/${slug}</loc>\n${alternates}\n  </url>`;
    }),
  );
  await write(
    'public/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
  );
  await write('public/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
}

async function run() {
  const started = performance.now();
  const count = await build();
  console.log(`docs: generated ${count} pages in ${Math.round(performance.now() - started)} ms`);
}

if (process.argv.includes('--watch')) {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => run().catch((error) => console.error(`\n${error.message}\n`)), 100);
  };
  await run().catch((error) => console.error(`\n${error.message}\n`));
  watch(contentDir, { recursive: true }, rebuild);
  watch(i18nDir, { recursive: true }, rebuild);
  console.log('docs: watching content/ and src/i18n/ for changes');
} else {
  try {
    await run();
  } catch (error) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
}
