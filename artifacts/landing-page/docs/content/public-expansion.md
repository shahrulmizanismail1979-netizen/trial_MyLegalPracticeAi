# Public content expansion

## Scope

This pass expands explanatory copy in `artifacts/landing-page` without changing routes, authentication, providers, checkout, pricing, state, actions, or portal availability. The bare-root LAWYes safe-preview homepage remains unchanged. The longer public guide appears only on the explicit `/apps` marketing page and uses closed native `details` elements so the page can remain scannable.

## Added or expanded

- Nine live-product guides cover a suitable use, input preparation, a bounded example instruction, result interpretation, and review before use.
- Eight public FAQs explain task scoping, document preparation, source-mode separation, citations, fail-closed verified research, dates and calculations, and final professional review.
- Contribution guidance now explains authority to share, file preparation, reviewer notes, the review sequence, and what submission or approval does and does not mean.
- Trust and security copy now describes user-side confidentiality and output-review responsibilities and avoids absolute security or privilege claims.
- The authenticated LAWYes matter workspace includes a closed, static “How to get a reviewable result” help panel. It does not alter submission, research-mode, save, export, or matter behaviour.

## Source and claims controls

- New legal-workflow copy is operational guidance, not a statement of Malaysian substantive law.
- Verified-library research and public-web research remain separate. The guide says that verified retrieval fails closed and that public-web research is an explicit, visibly unverified lane.
- Examples are fictional task formulations and do not assert legal outcomes, procedural rules, statutory periods, monetary figures, or jurisdictional thresholds.
- Copy consistently asks the responsible professional to verify source documents, current authoritative material, dates, calculations, procedure, and suitability before use.

## Intentionally untouched

- `src/data/legal-reference-guide.ts` and `src/components/legal-reference-guide.tsx` are excluded because another owner controls them.
- The safe-preview tools, practice, draft, matter, search, home, and verification content is untouched in this pass.
- Pricing amounts, trial language, bundle terms, payment flows, checkout eligibility, product routes, live/coming-soon status, contact details, terms, and privacy retention statements are unchanged.
- Auth screens, admin pages, subscription management, reception chat responses, contribution API payloads, upload behaviour, and authenticated matter actions are unchanged.
- No claim has been added about corpus size, publication status, legal accuracy, guaranteed confidentiality, successful outcomes, or compliance certification.

## Focused coverage

`src/data/public-content.test.ts` requires one complete guide per live portal, minimum content depth, source-mode language, professional verification wording, and the absence of guarantee language. Existing fixture tests continue to protect navigation, route, trust/privacy links, and safe-preview inventory.