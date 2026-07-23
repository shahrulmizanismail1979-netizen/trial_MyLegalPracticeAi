# Segmentation Scoring Rules — Phase 05

## Important Note

The composite score is a **deterministic, additive, weighted integer**.
It is explicitly **NOT** a calibrated probability or confidence level.
Thresholds are engineering checkpoints, not statistical measures.

## Signal Weights

| Signal type | Score contribution | Rationale |
|---|---|---|
| `NEUTRAL_CITATION` | +14 | Highest specificity — unique court/year/number triple |
| `NEW_CASE_TITLE` | +12 | Strong heading pattern distinct to case starts |
| `REPORT_CITATION` | +10 | MLJ/CLJ/AMR citation patterns are near-unique |
| `COURT_HEADING` | +10 | Court name as a block heading is structural |
| `PROCEEDING_NUMBER` | +10 | Civil suit / criminal appeal numbers are case-specific |
| `PARAGRAPH_RESET` | +8 | Numbering restarts signal a new document section |
| `PAGE_NUMBER_RESTART` | +8 | Page footer reset signals a new booklet boundary |
| `NEW_PARTY_CONFIGURATION` | +8 | `v.` / `lwn.` patterns between proper nouns |
| `JUDICIAL_SIGNATURE` | +8 | End-of-judgment structure |
| `CLOSING_ORDER` | +10 | Explicit order or dismissal language |
| `CORAM_HEADING` | +6 | "Coram:" in a heading signals new tribunal composition |
| `JUDGE_HEADING` | +6 | JC/J/FCJ/CJ suffix in heading context |
| `DECISION_DATE` | +5 | Date near judgment text, not inside body |
| `JUDGMENT_HEADING` | +5 | "Judgment" or "Penghakiman" section heading |
| `BLANK_DIVIDER_PAGE` | +5 | Blank pages between content are separators |
| `ABRUPT_METADATA_CHANGE` | +4 | Sharp change in court/year field |
| `PUBLISHER_DIVIDER` | +4 | Repeated rule / asterisk / em-dash divider |
| `MULTI_PAGE_GAP` | +4 | Page number jump ≥ 3 suggests booklet boundary |
| `ABRUPT_SEMANTIC_CHANGE` | +3 | Heuristic distance between adjacent page blocks |
| `TYPOGRAPHY_CHANGE` | +3 | Font size or style change in block metadata |
| `INCOMPLETE_CASE_END` | +3 | File ends without closing order or signature |
| `REPEATED_TITLE_IN_QUOTATION` | -8 | Same title inside a cited quotation — not a new case |
| `ADMINISTRATIVE_MATERIAL` | -6 | Index / cause list pages — not judgment content |
| `PUBLISHER_ATTRIBUTION` | -4 | Publisher name/address/copyright — editorial |

## Classification Thresholds

| Tier | composite_score | conflicting_signal_count |
|---|---|---|
| `STRONG_BOUNDARY_CANDIDATE` | ≥ 20 | = 0 |
| `MODERATE_BOUNDARY_CANDIDATE` | ≥ 12 | ≤ 1 |
| `WEAK_BOUNDARY_CANDIDATE` | ≥ 6 | ≤ 2 |
| `CONFLICTING_BOUNDARY` | > 0 but conflicts > 2, or conflicts exceed positives | — |
| `NO_BOUNDARY` | < 6 | — |

## Minimum Evidence Rule

A boundary must have either:
- **two or more independent signal types** (different `signal_type` values), OR
- **one signal type** with a single `score_contribution` ≥ 12
  (`STRONG_SINGLE_THRESHOLD`).

A single weak signal alone (score_contribution < 12, no second signal) yields
`NO_BOUNDARY` — never recorded as a boundary row.

## Auto-acceptance Rule

A boundary is `auto_accepted` only when:
- strength = `STRONG_BOUNDARY_CANDIDATE`, AND
- `conflicting_signal_count` = 0.

All other boundaries require human review (`review_required`).

## Conflicting Signal Count

The conflicting signal count on a page is the count of distinct **anti-signal**
instances (those with negative `score_contribution`) on that page.
Anti-signals are: `REPEATED_TITLE_IN_QUOTATION`, `ADMINISTRATIVE_MATERIAL`,
`PUBLISHER_ATTRIBUTION`.
