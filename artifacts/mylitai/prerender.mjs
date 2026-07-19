import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist/public');
const basePath = process.env.BASE_PATH || '/mylitai/';
const domain = process.env.REPLIT_DOMAINS?.split(',')[0]?.trim() || '';
const siteBase = domain ? `https://${domain}${basePath}` : '';

function patchHtml(html, { title, description, canonicalPath = '' }) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${description}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${title}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${description}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${description}" />`
  );

  if (siteBase) {
    const canonicalUrl = canonicalPath ? `${siteBase}${canonicalPath}` : siteBase;
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${canonicalUrl}" />`
    );
    html = html.replace(
      /<meta\s+property="og:image"\s+content="(\/[^"]*)"\s*\/?>/,
      (_, src) => `<meta property="og:image" content="https://${domain}${src}" />`
    );
    html = html.replace(
      /<meta\s+name="twitter:image"\s+content="(\/[^"]*)"\s*\/?>/,
      (_, src) => `<meta name="twitter:image" content="https://${domain}${src}" />`
    );
  }

  return html;
}

const indexPath = resolve(distDir, 'index.html');
const originalHtml = readFileSync(indexPath, 'utf-8');

const rootHtml = patchHtml(originalHtml, {
  title: 'MyLitAi — Malaysian Banking Litigation Practice',
  description: 'MyLitAi is an AI-powered Malaysian civil litigation practice platform covering banking litigation theory, case law, cause papers, workflows, costs and an Oral Advocacy practice suite.',
  canonicalPath: '',
});
writeFileSync(indexPath, rootHtml, 'utf-8');
console.log('Prerender: patched index.html');

const routes = [
  {
    file: 'login.html',
    canonicalPath: 'login',
    title: 'Sign In — MyLitAi | Malaysian Banking Litigation AI',
    description: 'Sign in to MyLitAi to access AI-powered Malaysian civil litigation and banking litigation practice tools.',
  },
];

for (const route of routes) {
  const html = patchHtml(originalHtml, route);
  writeFileSync(resolve(distDir, route.file), html, 'utf-8');
  console.log(`Prerender: wrote ${route.file}`);
}
