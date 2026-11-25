# Gonestly documentation

The documentation site of [Gonestly](https://github.com/yaboylino/gonestly), a modular application framework for Go. It is an Angular application that is prerendered to static HTML, in English and Dutch.

## Development

You need Node.js 24 or newer.

```sh
npm ci
npm start
```

`npm start` regenerates the content whenever a Markdown or translation file changes and serves the site on http://localhost:4200.

| Command          | What it does                                             |
| ---------------- | -------------------------------------------------------- |
| `npm start`      | Serves the site and rebuilds the content on every change |
| `npm run build`  | Builds the static site into `dist/gonestly-docs/browser` |
| `npm test`       | Tests the content pipeline and the application           |
| `npm run lint`   | Runs ESLint and checks the formatting with Prettier      |
| `npm run format` | Formats every file with Prettier                         |

## How the content works

- **Pages** are Markdown files in `content/<language>/<slug>.md`, with a `title` and a `description` in the front matter.
- **Navigation** lives in `content/navigation.json`: the rail areas, the sidebar sections and the pages in each.
- **Interface texts** are translated with [ngx-translate](https://github.com/ngx-translate/core) in `src/i18n/<language>.json`.
- **Site settings** such as the URL and the languages are in `content/site.json`.

`scripts/content/build.mjs` turns all of this into typed modules in `src/generated`: one lazily loaded chunk per page, a search index per language, the icons, a sitemap and `robots.txt`. The build fails with a clear list of problems when a page is missing in a language, a link or an anchor points nowhere, a translation key is missing or a code block uses an unknown language.

### Writing a page

Code blocks take an optional file name, and callouts use the GitHub alert syntax:

````md
```go title="users/module.go"
var Module = &gonestly.Module{Name: "users"}
```

> [!HINT]
> Tips use HINT; NOTE and WARNING work the same way.
````

Link to other pages by their slug, such as `[modules](modules#global-modules)`. Every page exists in every language; add it to `navigation.json` and write it in each `content/<language>` folder.

### Adding a language

Add the language code to `content/site.json`, create `src/i18n/<language>.json` with every key of `en.json`, add it to the loader in `src/app/language/bundled-translate-loader.ts`, give the callouts a label in `scripts/content/markdown.mjs`, and translate every page into `content/<language>`.

## Deployment

Every push to `main` builds the site and publishes it to GitHub Pages at https://yaboylino.github.io/gonestly-docs. The base path comes from the `url` in `content/site.json`, so moving to another domain is a one line change.

## License

[MIT](LICENSE)
