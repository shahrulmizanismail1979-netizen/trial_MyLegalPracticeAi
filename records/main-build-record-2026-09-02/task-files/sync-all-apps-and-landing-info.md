# Synchronize all product information

## What & Why
Audit and synchronize every customer-facing application and landing page so displayed product facts, research-corpus counts, subscription actions, terminology, and freshness indicators come from authoritative current sources instead of conflicting stale values. The goal is that a customer sees the same truthful information regardless of which LAWyes portal or landing page they open.

The research corpus must remain explicitly separated into source-document intake, verified judgments, indexed judgments, and judgments published to customer search. The current baseline found during planning is 2,152 Google Drive source files catalogued, 299 verified judgments, 193 indexed judgments, and 0 customer-searchable judgments.

## Done looks like
- Every registered customer-facing app and landing page has been audited for stale or conflicting product facts, counts, labels, and subscription-management wording.
- A canonical, database-backed information contract is used wherever a value can change at runtime; static portal-specific content counts are clearly labelled as curated/local rather than presented as the Drive research corpus.
- All relevant pages show the same current research status and do not call source documents “cases.”
- Landing-page hero, footer, feature/stat sections, portal entry pages, case-law pages, Profile/Account, Billing, and unsubscribe entry points use consistent current wording and links.
- All eight practitioner portals plus MyLawAcad, MyLawFirmAI, research-admin, and the public landing page build successfully with no route or base-path regressions.
- Browser verification confirms representative desktop/mobile landing and portal pages render current information, status requests succeed, and every visible subscription-management link reaches the central unsubscribe flow.
- The final report records which values are live database metrics, which are portal-specific curated content, and which still require editorial approval before becoming customer-searchable.

## Out of scope
- Do not bypass research rights, editorial review, accepted-headnote requirements, or publication controls merely to increase the displayed case count.
- Do not rewrite historical customer/matter data, invoices, subscriptions, or user-specific dashboard data as part of a copy/statistics synchronization.
- Do not claim that all Drive files are cases; do not replace a portal’s intentionally separate curated library count unless its source and meaning are verified.
- Do not change unrelated business logic or migrate databases solely to consolidate presentation metadata.

## Steps
1. Inventory every registered artifact, route shell, landing section, case-law page, Profile/Account page, Billing page, footer, and product-stat surface; record each displayed fact and its current source.
2. Define the authoritative source and meaning for each shared fact, including the live research-corpus breakdown and each portal’s intentionally separate curated content counts.
3. Extend or consolidate shared information contracts and UI components so customer-facing pages consume current values consistently, with explicit labels for intake, verification, indexing, and publication.
4. Update all portal shells and landing-page surfaces, including subscription-management links, to use the shared contract and consistent terminology while preserving each artifact’s branding and base path.
5. Add regression coverage for the shared information response, cross-artifact unsubscribe navigation, and representative desktop/mobile rendering across landing and practitioner portals.
6. Run library, API, and artifact typechecks/builds plus focused browser verification; document any pre-existing failures separately from regressions introduced by this synchronization.

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/corpus-status.ts`
- `artifacts/api-server/src/routes/cases.ts`
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/src/pages/home.tsx`
- `artifacts/landing-page/src/pages/manage-subscription.tsx`
- `artifacts/landing-page/src/components/hero.tsx`
- `artifacts/landing-page/src/components/footer.tsx`
- `artifacts/landing-page/src/components/powered-by-banner.tsx`
- `lib/case-home-ui/src/index.tsx`
- `lib/billing-ui/src/index.tsx`
- `artifacts/myaccidentai/src/App.tsx`
- `artifacts/mylitai/src/App.tsx`
- `artifacts/mylitai-irac/src/App.tsx`
- `artifacts/mycrimai/src/App.tsx`
- `artifacts/mysyariahai/src/App.tsx`
- `artifacts/mycorplegalai/src/App.tsx`
- `artifacts/myccblitai/src/App.tsx`
- `artifacts/myconveylitai/src/App.tsx`
- `artifacts/mylawacad/src/App.tsx`
- `artifacts/mylawfirmai/src/App.tsx`
- `artifacts/research-admin/src/pages/dashboard.tsx`
- `artifacts/research-admin/src/pages/drive-inventory.tsx`