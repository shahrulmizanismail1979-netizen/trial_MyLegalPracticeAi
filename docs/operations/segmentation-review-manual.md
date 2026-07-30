# Segmentation-Review Manual — Judgment Research Platform

**Audience:** Staff with `researcher`, `administrator`, or `owner` roles  
**Purpose:** Guide for reviewing segmentation results and approving/correcting case boundaries  
**Last updated:** 2026-07-30

---

## 1. What Is Segmentation Review?

After a document's text is extracted, the platform runs an automated segmentation engine that tries to detect how many legal cases are in the document. A single file may contain:
- No case (e.g. a cause list or administrative document)
- One case
- Many cases (30+ is normal for reporter volumes)
- A case that continues from another file

The engine proposes **case candidates** — each candidate is a span of pages believed to contain one complete legal judgment. When the engine is confident, the container moves forward automatically. When it is uncertain (e.g. conflicting signals, unusual formatting), it routes to **SEGMENTATION_REVIEW_REQUIRED** and you must review the proposals.

---

## 2. Finding Containers That Need Review

```
GET /api/research/containers?state=SEGMENTATION_REVIEW_REQUIRED
```

Or from the review queue:
```
GET /api/research/review-items?status=open&kind=segmentation_review
```

---

## 3. Inspecting a Container's Candidates

### 3.1 List all candidates

```
GET /api/research/containers/:id/candidates
```

Each candidate shows:
- `id` — candidate identifier
- `startPageNumber`, `endPageNumber` — the page span
- `strength` — boundary confidence (STRONG, MODERATE, WEAK)
- `reviewStatus` — pending, auto_accepted, reviewed, rejected
- Coherence check results (18 automated checks, each PASS/FAIL/UNCERTAIN/NOT_APPLICABLE)

### 3.2 Read a specific candidate

```
GET /api/research/candidates/:id
```

Returns the candidate with its full coherence check details. Pay attention to:

| Coherence check | What to look for |
|-----------------|-----------------|
| `HAS_BEGINNING` | First page should have a citation (e.g. `[2024] MLJU 123`) |
| `HAS_ENDING` | Last page should have a closing phrase ("Ordered accordingly", "Dismissed", etc.) |
| `NO_SOURCE_PAGE_GAP` | Pages should be contiguous (no missing numbers in the span) |
| `SINGLE_PARTY_BLOCK` | Party names should be consistent throughout |
| `CONSISTENT_CITATION` | The citation string should appear consistently |
| `CONSISTENT_COURT` | The court name should not change mid-judgment |
| `SEQUENTIAL_PARAGRAPHS` | Numbered paragraphs should increment without large gaps |
| `NO_PUBLISHER_CONTENT` | Publisher headnotes/editorial markers should not dominate |

A FAIL on `HAS_BEGINNING` or `HAS_ENDING` often means the candidate is incomplete — it may be a continuation from or into another file.

### 3.3 View the actual page text

```
GET /api/research/containers/:id/pages/:page_number
```

Read the raw extracted text to verify what the engine detected.

---

## 4. Actions You Can Take

For each candidate, choose one of:

### 4.1 Approve

The candidate looks correct — page span, coherence checks, and text all confirm one complete judgment.

```
POST /api/research/candidates/:id/approve
Body: { "notes": "Verified: complete judgment, correct boundaries" }
```

### 4.2 Reject

The candidate is not a valid judgment — it is a cause list, administrative page, or completely incorrect.

```
POST /api/research/candidates/:id/reject
Body: { "reason": "Administrative document — no judgment content" }
```

### 4.3 Request a split

The candidate actually contains two or more judgments that the engine merged. Flag it for manual splitting.

```
POST /api/research/candidates/:id/request-split
Body: { "notes": "Appears to contain two separate cases starting around page 47" }
```

### 4.4 Request a merge

Two adjacent candidates should actually be one judgment. Flag both for merging.

```
POST /api/research/candidates/:id/request-merge
Body: { "targetCandidateId": 456, "notes": "Continuation of candidate #456 — no closing order on #455" }
```

### 4.5 Request reprocessing

The automated run had a problem and should be re-run (e.g. extraction quality was later corrected).

```
POST /api/research/candidates/:id/request-reprocessing
```

---

## 5. Cross-File Spans

Sometimes a single judgment spans two or more source files (e.g. a volume split mid-judgment). The platform detects potential continuations automatically.

### 5.1 Finding cross-file relationships

```
GET /api/research/candidates/:id/cross-file-relationships
```

This shows any automatically detected relationships with other candidates:
- `POSSIBLE_CONTINUATION` — this candidate may continue from or into another
- `POSSIBLE_DUPLICATE` — near-identical content in another container
- `EXACT_DUPLICATE` — byte-identical content in another container

### 5.2 Confirming a cross-file span

When you confirm that candidate A continues into candidate B:

```
POST /api/research/cross-file-spans
Body: {
  "segments": [
    { "candidateId": 101, "sequenceNumber": 1 },
    { "candidateId": 102, "sequenceNumber": 2 }
  ],
  "notes": "Single judgment split across pilot-e1 and pilot-e2"
}
```

Then approve the span:
```
POST /api/research/cross-file-spans/:span_id/approve
```

---

## 6. After All Candidates Are Reviewed

Once all candidates in a container have a resolved `reviewStatus` (approved, rejected, or flagged), the container automatically progresses to `EDITORIAL_REVIEW_PENDING` and the editorial classification pipeline runs.

You do not need to manually advance the container.

---

## 7. EDITORIAL_REVIEW_REQUIRED

After editorial classification, some containers route to `EDITORIAL_REVIEW_REQUIRED` because the automated classifier found sections it could not confidently classify as either judicial text or publisher material.

```
GET /api/research/containers/:id/sections
```

Each section has a classification and a confidence score. Sections flagged `MANUAL_REVIEW_REQUIRED` need a human decision:

```
PATCH /api/research/containers/:id/sections/:section_id
Body: {
  "classification": "VERIFIED_JUDICIAL_TEXT",
  "reviewerNote": "This is the judge's own summary, not a publisher headnote"
}
```

Valid classifications for override:
- `VERIFIED_JUDICIAL_TEXT` — confirmed judicial body text
- `PROBABLE_JUDICIAL_TEXT` — likely judicial, high confidence
- `SUSPECTED_PUBLISHER_EDITORIAL` — publisher-created; should be isolated

---

## 8. When to Escalate

Escalate to the **administrator** when:
- A container is stuck in a review state for more than 5 working days without action
- You suspect a segmentation engine defect (e.g. systematic errors on a particular document type)
- A container is in a state that does not match what you expect after your action

Escalate to the **legal reviewer** when:
- A candidate's content raises concerns about whether the document should be in the platform at all
- You encounter content that appears to be subject to a restriction (suppression order, anonymisation requirement)
