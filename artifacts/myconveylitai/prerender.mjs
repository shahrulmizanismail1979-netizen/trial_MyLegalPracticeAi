import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist/public');
const basePath = process.env.BASE_PATH || '/myconveylitai/';
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
  title: 'MyConveyLitAI — AI-Powered Malaysian Conveyancing Legal Practice',
  description: 'MyConveyLitAI is an AI-powered conveyancing platform for Malaysian property lawyers — land transactions, cause papers, workflows, and AI legal research tools.',
  canonicalPath: '',
});
writeFileSync(indexPath, rootHtml, 'utf-8');
console.log('Prerender: patched index.html');

const routes = [
  {
    file: 'login.html',
    canonicalPath: 'login',
    title: 'Sign In — MyConveyLitAI',
    description: 'Sign in to MyConveyLitAI to access AI-powered Malaysian conveyancing legal practice tools.',
  },
  {
    file: 'signup.html',
    canonicalPath: 'signup',
    title: 'Create Account — MyConveyLitAI',
    description: 'Create a MyConveyLitAI account to access AI-powered Malaysian conveyancing legal practice tools.',
  },
  {
    file: 'pricing.html',
    canonicalPath: 'pricing',
    title: 'Pricing — MyConveyLitAI | Malaysian Conveyancing AI Subscription',
    description: 'View MyConveyLitAI subscription plans and pricing for Malaysian conveyancing law practitioners.',
  },
];

for (const route of routes) {
  const html = patchHtml(originalHtml, route);
  writeFileSync(resolve(distDir, route.file), html, 'utf-8');
  console.log(`Prerender: wrote ${route.file}`);
}
