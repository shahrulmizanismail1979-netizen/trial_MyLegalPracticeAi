import { build } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  configFile: resolve(__dirname, 'vite.ssr.config.ts'),
  logLevel: 'warn',
});

const { render } = await import(resolve(__dirname, 'dist/server/entry-server.js'));
const htmlPath = resolve(__dirname, 'dist/public/index.html');
const template = readFileSync(htmlPath, 'utf-8');
const rendered = render();

if (!template.includes('<!--ssr-outlet-->')) {
  throw new Error('Prerender outlet is missing from the built HTML.');
}

writeFileSync(htmlPath, template.replace('<!--ssr-outlet-->', rendered));
console.log('Prerender: Project Sarawak 20 landing content injected.');