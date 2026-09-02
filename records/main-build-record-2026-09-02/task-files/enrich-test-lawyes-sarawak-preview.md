# Enrich LAWYes Sarawak Preview

## What & Why
Expand the simplified LAWYes Sarawak Safe Preview into a much richer practitioner demonstration while preserving its four-action, progressive-disclosure experience. Test-drive every major flow, repair faulty or confusing behavior, and test-drive it again so the preview feels substantial, reliable, and honest without connecting to production systems.

## Done looks like
- The opening screen remains simple and mobile-first, with one instruction box and four primary actions.
- Search, drafting, matter work, and all six Sarawak Practice Centre categories contain substantially more useful structured material, contextual guidance, examples, checklists, source notes, and verification detail.
- Enrichment clearly distinguishes verified law, access records, practitioner-review material, demonstrations, and known content gaps; no unverified legal proposition is presented as authoritative.
- Search offers guided filters, coherent jurisdiction behavior, useful empty states, visible result context, reliable history/deep links, and clear copy/export feedback.
- Draft generation requires its stated safeguards, uses pack-appropriate fields and defaults, and exports a useful source-and-gap manifest without implying lawyer approval.
- Matter work requires meaningful material selection, carries the client reference and chosen materials into confirmation, supports a clear Search/Draft handoff, and remains explicitly local-only.
- All visible buttons, links, navigation, disclosures, exports, keyboard paths, browser Back behavior, and responsive layouts work on desktop and mobile.
- A first browser test drive records defects, repairs address those defects, and a second browser test drive confirms the repaired flows with no new console errors.
- The Safe Preview remains isolated from production APIs, databases, authentication, uploads, billing, AI, persistence, and server writes.

## Out of scope
- Publishing or modifying `mylegalpracticeai.life`.
- Adding production integrations, persistence, authentication, billing, uploads, database access, or live AI.
- Claiming substantive Sarawak case reports or legal conclusions that have not completed the existing provenance and lawyer-review gate.
- Replacing the four-action information architecture with a dense dashboard.

## Steps
1. **Baseline test drive** -- Exercise every primary action, navigation path, disclosure, filter, report view, drafting step, matter step, export, browser-history behavior, keyboard path, and mobile layout; record reproducible defects and confusing states.
2. **Deepen the content model** -- Add significantly richer structured Sarawak coverage, official-source guidance, practical workflows, checklists, decision support, drafting intake, examples, provenance, verification metadata, and transparent gap notices without manufacturing authority.
3. **Improve search and report use** -- Add guided taxonomies and contextual result information, reconcile jurisdiction/filter behavior, strengthen empty/reset states, preserve useful URL/history state, and make copy/export outcomes explicit.
4. **Repair drafting safeguards** -- Require acknowledgements, tailor intake and output to each pack, show source and uncertainty manifests, and ensure every generated item remains clearly marked for practitioner review.
5. **Repair matter workflow** -- Require selected materials, carry entered details through confirmation, expose selected-source context, provide safe exports and handoffs, and keep the demonstration non-persistent.
6. **Preserve progressive disclosure** -- Keep advanced metadata, audits, source histories, and detailed practice content behind clear disclosures while improving desktop and mobile readability, keyboard access, focus handling, and overflow behavior.
7. **Strengthen regression coverage** -- Extend fixture and browser tests for content integrity, safety isolation, navigation/history, filters, safeguards, matter requirements, source links, exports, clipboard feedback, and responsive behavior.
8. **Final test drive and audit** -- Restart only the relevant workflow, rerun focused automated checks, repeat the desktop and mobile browser journey, repair any remaining regressions, and update the Safe Preview audit with verified counts and limitations.

**Critical constraints:** All work stays confined to the development-only Safe Preview. Richness must come from structured, source-aware practitioner assistance and transparent demonstrations, never invented legal authority or concealed uncertainty.

## Relevant files
- `artifacts/landing-page/src/pages/lawyes-safe-preview.tsx`
- `artifacts/landing-page/src/fixtures/lawyes-preview.ts`
- `artifacts/landing-page/src/fixtures/lawyes-preview.test.ts`
- `artifacts/landing-page/src/fixtures/lawyes-verified-reports.json`
- `artifacts/landing-page/src/index.css`
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/LAWYES_SARAWAK_SAFE_PREVIEW_AUDIT.md`
- `docs/lawyes-sarawak-safe-preview-audit.md`
- `artifacts/api-server/e2e/lawyes-safe-preview-source.spec.ts`