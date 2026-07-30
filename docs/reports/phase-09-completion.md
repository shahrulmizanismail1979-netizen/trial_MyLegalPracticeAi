# Phase 09 Completion Report — Exact Quotations & Citation Tools

**Date:** 2026-07-25  
**Phase:** 09  
**Status:** COMPLETE

---

## Objective

Give lawyers and researchers the ability to lift exact passages from verified judgments and format them as legally defensible citations — with full provenance, byte-level integrity guarantees, alteration tracking, and six citation style templates that never invent metadata.

---

## Deliverables

### Database Migrations (`0015-phase09-quotations.sql`)

Two new tables:

| Table | Purpose |
|---|---|
| `research_quotations` | Provenance-traced quotation records; exact selected text, judgment FK, case name (denormalised), citation, court, judge, date, paragraph ID, source page FK, char offsets, source text checksum at creation, creator FK, note |
| `research_quotation_alterations` | Child table per deliberate edit; kind (omission/insertion/alteration), position start/end, original text, replacement text, recorded by; presence of any row flips parent `kind` to `"altered"` |

---

### Quotations Module (`research/quotations/`)

| File | Responsibility |
|---|---|
| `integrity.ts` | `verifyQuotationSelection(judgmentId, paragraphId, start, end, text)` — reconstructs paragraph from approved judicial spans, slices at offsets, compares byte-for-byte; hard rejection on mismatch; returns SHA-256 of source paragraph |
| `service.ts` | `createQuotation`, `getQuotation` (with live checksum re-check → `sourceChanged: true`), `recordAlteration`, `listQuotations`; createQuotation calls integrity check first |
| `citationFormatter.ts` | `formatCitation(quotation, style, metadata)` — six styles: neutral-citation-first, oscola, malaysian, bluebook, academic-footnote, bibliography; renders `"REPORTER CITATION NOT VERIFIED"` when required citation absent from verified metadata |

---

### API Routes (`research/routes/quotations.ts`)

- `POST /api/research/quotations` — create (researcher role or above; integrity check runs)
- `GET /api/research/quotations/:id` — read with live checksum comparison
- `PATCH /api/research/quotations/:id/alterations` — append alteration record
- `GET /api/research/quotations/:id/cite?style=…` — formatted citation string
- `GET /api/research/quotations/:id/export` — provenance bundle; refused for guest role
- `GET /api/research/judgments/:judgmentId/quotations` — list by judgment

---

### Key Design Decisions

1. **Byte-level integrity, hard rejection** — the integrity check is not advisory; a selection that does not match the verified paragraph text is rejected with a structured error, never silently accepted.
2. **Altered quotations cannot be cited as exact** — any quotation with alteration rows has `kind: "altered"`; the API rejects a cite request with `style=exact` for an altered quotation.
3. **Citation formatter never invents** — if a required metadata field is absent and has not been corrected by an authorised reviewer, the template renders a visible placeholder, not a guess.
4. **`sourceChanged` flag on read** — quotations created against source text that later changed are flagged on every read; the caller is never silently served a mismatched passage.

---

## Tests (`phase09.test.ts`)

**23 new tests; 312 total tests across all phases.**

Coverage: exact selection (record created, checksum stored); multi-paragraph selection; punctuation and Unicode in passage text; footnote markers; ellipsis alteration (kind becomes `"altered"`, original preserved); bracketed addition; missing reporter citation (formatter renders placeholder); restricted export (guest 403, researcher permitted); changed source text (`sourceChanged: true`); altered quotation not presentable as exact.

---

## PHASE: 09 | STATUS: complete | CHECKPOINT: 2026-07-25
