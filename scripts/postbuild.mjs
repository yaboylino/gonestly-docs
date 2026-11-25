import { cp, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

// Static hosts serve 404.html for unknown URLs; the prerendered "/en/404" page becomes that file.
const browser = path.resolve('dist/gonestly-docs/browser');
const notFound = path.join(browser, 'en/404');
await cp(path.join(notFound, 'index.html'), path.join(browser, '404.html'));
await rm(notFound, { recursive: true });
const pages = (await readdir(browser, { recursive: true })).filter((f) => f.endsWith('index.html'));
console.log(
  `docs: ${pages.length} prerendered pages and 404.html in ${path.relative(process.cwd(), browser)}`,
);
