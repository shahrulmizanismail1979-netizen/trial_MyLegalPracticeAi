# SEO Strategy

## In scope
- Public landing page at `/`
- Public brand and product discovery content for the AI Web Books / AI Portals offering
- Public contribution form at `/contribute` as a utility page with lower SEO priority than the homepage

## Out of scope
- Authenticated or operational admin dashboard routes under `/admin/**`
- Internal API routes under `/api/**`

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
- The public site is deployed as a static artifact with a prerendered homepage at `/`.
- Secondary public routes such as `/contribute` still rely on the shared HTML shell unless they are explicitly prerendered or given route-specific metadata.
- Social bots and AI crawlers only see the initial HTML response; route-specific Open Graph and canonical tags must exist in that HTML to be reliable.

## Dismissed categories
- (None yet)
