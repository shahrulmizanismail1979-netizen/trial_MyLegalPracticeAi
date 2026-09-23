# Operations content expansion

## Scope

This second content-only pass enriches operational help inside `mylawacad`, `mylawfirmai` and `sarawak20`. It follows the earlier homepage introductions and adds guidance where a user designs, reviews, captures, manages or retains work.

No routes, handlers, authentication, pricing, subscription behavior, state, backend services, API contracts, templates or computational logic were changed.

## Coverage

### `mylawacad`

| Surface | Added operational guidance |
| --- | --- |
| Assessment Frameworks | Outcome and input preparation; framework selection; a worked task-design example; moderation and acceptance checks; source, privacy and record-retention cautions; framework FAQ |
| Marking Centre | Human-review sequence; flag and confidence interpretation; bulk-regrade preparation; consistent override and sign-off practice; student-record privacy; marking FAQ |
| Attempt Summary | Score and criterion interpretation; response-review steps; a concrete practice action; report privacy; results FAQ |

### `mylawfirmai`

| Surface | Added operational guidance |
| --- | --- |
| User Guide | Bilingual prepare/review/record playbook; concrete client-update task example; confidentiality caution; AI draft, deadline-diary and source-record FAQs |
| Voice Task | Bilingual instruction anatomy and concrete voice example; recording privacy; transcript, missing-field, draft and deadline review |
| Meeting Minutes | Bilingual recording/transcript preparation; speaker and action-item inputs; generated-minutes review, approval and uncertainty handling |

### `sarawak20`

| Surface | Added operational guidance |
| --- | --- |
| Programme landing | Four-step participant playbook; workflow examples and preparatory inputs; prototype interpretation; acceptance and practitioner-review gate; test records; privacy boundary; programme FAQ |
| Eligibility dialog | Preparation checklist; minimisation guidance; verification-purpose boundary; client-confidentiality warning |
| Manage Subscription | Billing-input preparation; trusted-device caution; denied-access, record-retention and credential FAQ |
| Checkout Success | Access-code handover, billing records, safe first test and practitioner-review checklist |

## Legal-content boundary

No case, citation, statutory provision, legal test, filing deadline, limitation period or guaranteed outcome was added. New legal-facing text is limited to process cautions: users must independently check current primary material, jurisdiction, forum, local practice, forms and deadlines, and a responsible practitioner must review real-world work.

Because this pass introduces no new substantive legal proposition, no additional external legal-source claim was required. The source and currency limits recorded in `docs/content/legal-verification-register.md` remain applicable.

## Privacy and records boundary

The new guidance consistently directs users to minimise or anonymise personal and client information, use authorised source material, restrict sharing, retain official work in approved firm or institutional systems, and treat product/test/task records as supplements rather than replacements.

## Verification

Scoped TypeScript checks completed successfully:

- `pnpm --filter @workspace/mylawacad typecheck`
- `pnpm --filter @workspace/mylawfirmai typecheck`
- `pnpm --filter @workspace/sarawak20 typecheck`

No builds, workflow restarts or backend operations were run.