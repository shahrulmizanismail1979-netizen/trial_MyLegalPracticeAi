---
name: Practice hub content mapping
description: How MyLitAI's "Your Online LA" hub maps matters to workflows/forms without duplicating content, and the matching pitfalls.
---

The hub (`src/data/practice-hub.ts`) organises existing library content by matter; it stores no content itself.

**Rules:**
- Map cause papers by exact `formNumber` strings (unique in the seed), never by DB id (ids are serial per environment) and never by shared order numbers — e.g. "Form O48" is the JDS exam summons, not a garnishee paper.
- Workflow matching is by title keywords; keep keywords narrow or matters cross-contaminate (e.g. "interlocutory application" pulls the general chambers workflow everywhere).
- The fuzzy `matchForm` chip matcher must only match on substantial title containment (≥12 chars) or ≥3 shared significant words; form-number containment produced wrong draft buttons.

**Why:** a draft button that opens the wrong precedent is worse than no button — reviewers flagged this as the top failure mode.

**How to apply:** when adding matters or forms, verify each configured formNumber exists in the live `/api/lit/forms` response and that each workflow keyword matches only the intended workflows.
