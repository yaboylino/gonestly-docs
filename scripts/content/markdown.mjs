import { Marked } from 'marked';
import { createHighlighter } from 'shiki';

const LANGUAGES = ['go', 'sh', 'bash', 'json', 'yaml', 'text', 'dotenv', 'sql'];
const CALLOUT_LABELS = {
  en: { note: 'Note', hint: 'Hint', warning: 'Warning' },
  nl: { note: 'Opmerking', hint: 'Tip', warning: 'Let op' },
};

/** Turns a heading into a URL fragment, e.g. "Global modules" into "global-modules". */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** Splits front matter of simple "key: value" lines from the body. */
export function parseFrontMatter(source, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) {
    throw new Error(`${file}: missing front matter with a title and a description`);
  }
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(':');
    if (separator < 0) throw new Error(`${file}: invalid front matter line "${line}"`);
    data[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  for (const key of ['title', 'description']) {
    if (!data[key]) throw new Error(`${file}: front matter needs a "${key}"`);
  }
  return { data, body: source.slice(match[0].length) };
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Parses a fence info string such as `go title="users/module.go"`. */
export function parseFenceInfo(info = '') {
  const [language = 'text', ...rest] = info.trim().split(/\s+/);
  const title = /title="([^"]*)"/.exec(rest.join(' '))?.[1];
  return { language: language || 'text', title };
}

/** Turns rendered HTML into plain text; block elements become spaces, inline tags disappear. */
export function stripHtml(html) {
  return html
    .replace(/<a class="anchor"[^>]*>.*?<\/a>/g, '')
    .replace(/<button[\s\S]*?<\/button>/g, '')
    .replace(/<\/?(p|li|ul|ol|div|pre|h[1-6]|tr|td|th|table|aside|blockquote|br)\b[^>]*>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Creates a renderer; `icons` holds the inner SVG markup of the copy and check icons. */
export async function createMarkdownRenderer(icons) {
  const svg = (name, className) =>
    `<svg class="${className}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${icons[name]}</svg>`;

  const highlighter = await createHighlighter({
    themes: ['github-dark-default'],
    langs: LANGUAGES,
  });

  /** Renders one page and returns its HTML, headings and the links it contains. */
  return function render(body, { lang, file, copyLabel, copiedLabel }) {
    const headings = [];
    const links = [];
    const ids = new Set();
    const problems = [];
    const labels = CALLOUT_LABELS[lang];
    if (!labels) throw new Error(`${file}: no callout labels for language "${lang}"`);

    const marked = new Marked({ gfm: true });
    marked.use({
      renderer: {
        heading({ tokens, depth, text }) {
          const inner = this.parser.parseInline(tokens);
          if (depth === 1) {
            problems.push(
              `${file}: use the front matter title instead of a level 1 heading ("${text}")`,
            );
          }
          let id = slugify(text);
          for (let n = 2; ids.has(id); n++) id = `${slugify(text)}-${n}`;
          ids.add(id);
          if (depth === 2 || depth === 3)
            headings.push({ id, text: stripHtml(inner), level: depth });
          return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
        },
        code({ text, lang: info }) {
          const { language, title } = parseFenceInfo(info);
          if (!LANGUAGES.includes(language)) {
            problems.push(
              `${file}: unsupported code language "${language}", use one of ${LANGUAGES.join(', ')}`,
            );
          }
          const highlighted = highlighter.codeToHtml(text, {
            lang: LANGUAGES.includes(language) ? language : 'text',
            theme: 'github-dark-default',
            transformers: [
              {
                pre(node) {
                  delete node.properties.style;
                  delete node.properties.tabindex;
                },
              },
            ],
          });
          const header = title ? `<div class="code-title">${escapeHtml(title)}</div>` : '';
          return `<div class="code-block" data-language="${language}">${header}<button class="code-copy" type="button" data-copy aria-label="${escapeHtml(copyLabel)}" data-copied-label="${escapeHtml(copiedLabel)}">${svg('copy', 'icon-copy')}${svg('check', 'icon-check')}</button>${highlighted}</div>\n`;
        },
        blockquote({ tokens }) {
          const inner = this.parser.parse(tokens);
          const callout = /^<p>\[!(NOTE|HINT|WARNING)\]\s*/.exec(inner);
          if (!callout) return `<blockquote>${inner}</blockquote>\n`;
          const kind = callout[1].toLowerCase();
          return `<aside class="callout callout-${kind}"><strong class="callout-label">${labels[kind]}</strong><p>${inner.slice(callout[0].length)}</aside>\n`;
        },
        link({ href, title, tokens }) {
          const inner = this.parser.parseInline(tokens);
          const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
          if (/^[a-z]+:/i.test(href)) {
            return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${inner}</a>`;
          }
          links.push(href);
          return `<a href="${escapeHtml(href)}"${titleAttr} data-internal>${inner}</a>`;
        },
        table(token) {
          const header = token.header
            .map((cell) => `<th>${this.parser.parseInline(cell.tokens)}</th>`)
            .join('');
          const rows = token.rows
            .map(
              (row) =>
                `<tr>${row.map((cell) => `<td>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`,
            )
            .join('');
          return `<div class="table-wrap"><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>\n`;
        },
      },
    });

    const html = marked.parse(body, { async: false });
    return { html, headings, links, problems };
  };
}

/** Splits rendered HTML into one search section per heading, plus the text before the first one. */
export function searchSections(html) {
  const sections = [];
  const parts = html.split(/(?=<h[23] id=")/);
  for (const part of parts) {
    const heading = /^<h[23] id="([^"]+)">(.*?)<\/h[23]>/s.exec(part);
    const text = stripHtml(heading ? part.slice(heading[0].length) : part);
    sections.push({
      id: heading?.[1] ?? null,
      heading: heading ? stripHtml(heading[2]) : null,
      text: text.length > 600 ? `${text.slice(0, 600)}...` : text,
    });
  }
  return sections.filter((s) => s.heading || s.text);
}
