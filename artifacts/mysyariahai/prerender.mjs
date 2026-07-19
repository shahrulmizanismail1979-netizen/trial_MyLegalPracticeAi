import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist/public');
const basePath = process.env.BASE_PATH || '/mysyariahai/';
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
  title: 'MySyariahAI — AI Shariah Legal Practice Platform for Malaysia',
  description: 'MySyariahAI is an AI-powered Shariah legal practice platform for Malaysian practitioners — multilingual legal research, case analysis, document drafting, and practice management across civil, criminal, and advisory matters.',
  canonicalPath: '',
});
writeFileSync(indexPath, rootHtml, 'utf-8');
console.log('Prerender: patched index.html');

// Generate sitemap.xml — only the root URL is crawlable (all routes are auth-gated).
// The sitemap canonical URL reflects the actual deployed base path and domain.
const sitemapBase = siteBase || basePath;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${sitemapBase}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
writeFileSync(resolve(distDir, 'sitemap.xml'), sitemap, 'utf-8');
console.log('Prerender: wrote sitemap.xml');

// Generate robots.txt with the correct sitemap URL.
const sitemapUrl = domain ? `https://${domain}${basePath}sitemap.xml` : `${basePath}sitemap.xml`;
const robots = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
writeFileSync(resolve(distDir, 'robots.txt'), robots, 'utf-8');
console.log('Prerender: wrote robots.txt');
