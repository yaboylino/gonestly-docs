import { spawn } from 'node:child_process';

// Regenerates the content on every change while the Angular dev server reloads the page.
const children = [
  spawn('node', ['scripts/content/build.mjs', '--watch'], { stdio: 'inherit' }),
  spawn('npx', ['ng', 'serve'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];
const stop = () => children.forEach((child) => child.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((child) => child.on('exit', (code) => code && process.exit(code)));
