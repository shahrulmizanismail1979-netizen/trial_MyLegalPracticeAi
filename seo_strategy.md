# SEO Strategy

## In scope
- Public landing page at `/`
- Public brand and product discovery content for the AI Web Books / AI Portals offering
- Public product-artifact landing, login, pricing, signup, and access routes mounted under subpaths such as `/mylitai/`, `/mylitai-irac/`, `/mysyariahai/`, `/mycorplegalai/`, `/myconveylitai/`, `/mycrimai/`, `/myccblitai/`, and `/myaccidentai/`
- Public contribution form at `/contribute` as a utility page with lower SEO priority than the homepage

## Out of scope
- Authenticated or operational admin dashboard routes under `/admin/**`
- Internal API routes under `/api/**`
- Authenticated workspace/application surfaces after login or access gating

## Target audience
- Malaysian legal professionals
- Lawyers and litigators
- Corporate secretaries
- Other Malaysian legal practitioners evaluating AI-assisted legal reference tools

## Primary keywords
- AI legal reference platform Malaysia
- AI legal tools for Malaysian lawyers
- Malaysian legal AI portals
- AI-powered legal reference for litigators

## Notes
- The public site is deployed as a multi-artifact static setup with a prerendered homepage at `/`.
- The homepage is crawler-visible in initial HTML, but many product artifacts are path-mounted SPAs that still rely on client-side routing for their public discovery routes.
- `/contribute` now has its own route-specific HTML shell and is intentionally `noindex, follow`, but its built HTML body can still be empty if prerender injection is skipped.
- Social bots and AI crawlers only see the initial HTML response; route-specific Open Graph, canonical, and crawlable body content must exist in that HTML to be reliable.

## Dismissed categories
- Thin-content findings on intentionally `noindex` utility pages unless they also create a crawlability, navigation, or social-preview problem