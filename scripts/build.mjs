import { spawnSync } from 'node:child_process';
import { cp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

// The site is served from the path of its URL, e.g. "/gonestly-docs/" on GitHub Pages.
const site = JSON.parse(await readFile('content/site.json', 'utf8'));
const baseHref = `${new URL(site.url).pathname.replace(/\/$/, '')}/`;

const build = spawnSync('npx', ['ng', 'build', '--base-href', baseHref], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

// Static hosts serve 404.html for unknown URLs; the prerendered "/en/404" page becomes that file.
const browser = path.resolve('dist/gonestly-docs/browser');
const notFound = path.join(browser, 'en/404');
await cp(path.join(notFound, 'index.html'), path.join(browser, '404.html'));
await rm(notFound, { recursive: true });
const pages = (await readdir(browser, { recursive: true })).filter((f) => f.endsWith('index.html'));
console.log(`docs: ${pages.length} prerendered pages and 404.html for ${baseHref}`);
