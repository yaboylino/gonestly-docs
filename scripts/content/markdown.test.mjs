import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createMarkdownRenderer,
  parseFenceInfo,
  parseFrontMatter,
  searchSections,
  slugify,
  stripHtml,
} from './markdown.mjs';

const icons = { copy: '<path d="c"/>', check: '<path d="k"/>' };
const render = await createMarkdownRenderer(icons);
const options = { lang: 'en', file: 'test.md', copyLabel: 'Copy code', copiedLabel: 'Copied' };

describe('slugify', () => {
  it('creates readable fragments', () => {
    assert.equal(slugify('Global modules'), 'global-modules');
    assert.equal(slugify('Één instantie, twee types'), 'een-instantie-twee-types');
    assert.equal(slugify('Built-in <code>providers</code>'), 'built-in-providers');
  });
});

describe('parseFrontMatter', () => {
  it('reads the title and description', () => {
    const { data, body } = parseFrontMatter(
      '---\ntitle: Modules\ndescription: About modules\n---\nBody',
      'x.md',
    );
    assert.deepEqual(data, { title: 'Modules', description: 'About modules' });
    assert.equal(body, 'Body');
  });

  it('requires a title and a description', () => {
    assert.throws(() => parseFrontMatter('No front matter', 'x.md'), /missing front matter/);
    assert.throws(() => parseFrontMatter('---\ntitle: X\n---\n', 'x.md'), /needs a "description"/);
  });
});

describe('parseFenceInfo', () => {
  it('reads the language and an optional title', () => {
    assert.deepEqual(parseFenceInfo('go title="main.go"'), { language: 'go', title: 'main.go' });
    assert.deepEqual(parseFenceInfo(''), { language: 'text', title: undefined });
  });
});

describe('render', () => {
  it('collects headings with unique ids and anchors', () => {
    const { html, headings } = render('## Setup\n\ntext\n\n### Setup\n', options);
    assert.deepEqual(headings, [
      { id: 'setup', text: 'Setup', level: 2 },
      { id: 'setup-2', text: 'Setup', level: 3 },
    ]);
    assert.match(html, /<h2 id="setup"><a class="anchor" href="#setup"/);
  });

  it('rejects level 1 headings and unknown code languages', () => {
    const { problems } = render('# Title\n\n```cobol\nx\n```\n', options);
    assert.equal(problems.length, 2);
  });

  it('renders code blocks with a title and a translated copy button', () => {
    const { html } = render('```go title="main.go"\npackage main\n```\n', options);
    assert.match(html, /<div class="code-title">main.go<\/div>/);
    assert.match(html, /aria-label="Copy code" data-copied-label="Copied"/);
    assert.match(html, /class="shiki/);
  });

  it('renders callouts with a translated label', () => {
    const { html } = render('> [!WARNING]\n> Careful.\n', { ...options, lang: 'nl' });
    assert.match(
      html,
      /<aside class="callout callout-warning"><strong class="callout-label">Let op<\/strong><p>Careful.<\/p>/,
    );
  });

  it('marks internal links and opens external links in a new tab', () => {
    const { html, links } = render('[a](modules#exports) [b](https://go.dev)', options);
    assert.deepEqual(links, ['modules#exports']);
    assert.match(html, /href="modules#exports" data-internal/);
    assert.match(html, /href="https:\/\/go.dev" target="_blank" rel="noopener noreferrer"/);
  });
});

describe('search text', () => {
  it('decodes entities and keeps code tokens together', () => {
    const { html } = render('```go\nvar m = &gonestly.Module{}\n```\n', options);
    assert.equal(stripHtml(html), 'var m = &gonestly.Module{}');
  });

  it('splits the page into sections per heading', () => {
    const { html } = render('Intro text.\n\n## Exports\n\nExport text.\n', options);
    assert.deepEqual(searchSections(html), [
      { id: null, heading: null, text: 'Intro text.' },
      { id: 'exports', heading: 'Exports', text: 'Export text.' },
    ]);
  });
});
