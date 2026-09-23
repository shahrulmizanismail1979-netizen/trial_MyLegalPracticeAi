# Second content-only enrichment coverage

## Scope

This pass changed frontend guidance only in `mycorplegalai`, `myccblitai`, `myconveylitai`, and `myaccidentai`. It did not change handlers, routes, authentication, pricing, application state, AI prompts, backend code, database code, or seed data.

## Exact coverage

### MyCorpLegalAI

- Added an expandable preparation, expected-structure, evidence-gap, practitioner-review and FAQ surface to every practitioner tool detail page.
- Added tailored guidance for Legal Opinion Writer, Transaction Structure Advisor, Due Diligence Report Generator and Contract Review.
- Other corporate tools receive category-neutral practitioner workflow guidance.
- Existing tool example scenarios are reused as example framing; no case examples were invented.

### MyCCBLitAI

- Added an expandable matter-preparation and quality guide inside every live AI tool form.
- Guidance adapts to litigation/pleading, banking/facility, corporate/governance and general commercial tools.
- Each guide covers source inputs, intended output structure, evidential gaps, review checks, an input example and short FAQs.
- Existing tool-provided sample values are surfaced as the example where available.

### MyConveyLitAI

- Added an expandable mode-aware guide to substantive AI tools in the existing AI panel.
- Tailored guidance is provided for the Drafter, SPA/Contract Reviewer, Due Diligence Report and Practitioner Checklist.
- Remaining substantive modes receive a conveyancing-specific baseline covering title/party inputs, assumptions, expected output, gaps and local-practice review.
- Tutor, quiz, mock-exam and simulator modes are intentionally excluded because they are not transaction work-product surfaces.

### MyAccidentAI

- Added detailed preparation, output, evidence-gap, review, example and FAQ guidance to AI Case Analyzer and AI Document Drafter.
- Added cause-paper preparation, drafting-structure, common-gap and pre-filing review guidance to the Cause Paper Generator.
- Added file-evidence, gap-tracking and close-out review guidance to Practice Checklists.

## Content basis and safeguards

New content is non-authoritative practitioner process guidance. It does not add substantive legal propositions, fabricated cases or deadlines. New guidance repeatedly directs users to verify law, authorities, calculations, procedure, registry practice and source documents before use. The LAWYes source-mode policy is unaffected because no research retrieval or drafting source lane was changed.