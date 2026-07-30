# Staff Ingestion Manual — Judgment Research Platform

**Audience:** Staff with `owner`, `administrator`, or `rights_reviewer` roles  
**Purpose:** Step-by-step guide for ingesting legal judgment documents  
**Last updated:** 2026-07-30

---

## 1. Before You Upload

### 1.1 What belongs in the platform

- Legal judgments from Malaysian courts
- Files obtained from official court sources, licensed publishers, or rights holders who have given written authorisation
- Single files, multi-file folders, or ZIP archives

### 1.2 What does NOT belong

- Files you do not have rights to process (even for research purposes)
- Personal data not part of a judgment (e.g. private correspondence)
- Files containing content that is subject to a court order restricting disclosure

If you are unsure, **do not upload**. Consult a rights reviewer first.

### 1.3 File requirements

| Requirement | Limit |
|-------------|-------|
| Maximum file size | 50 MB per file |
| Maximum files per batch | 25 |
| Supported formats | PDF, TXT, DOCX |
| ZIP archives | Supported; contents must meet the above limits |

---

## 2. Uploading Documents

### 2.1 Single file or batch upload

```
POST /api/research/uploads
Content-Type: multipart/form-data
Body: files[] = <file(s)>
      source_batch = "batch-name-2026-07"  (optional label)
```

The system will:
1. Validate each file (format, size, integrity)
2. Compute SHA-256 checksum and detect byte-identical duplicates
3. Stage the original bytes in private object storage
4. Register each accepted file as a source container with status `UNREVIEWED`

### 2.2 ZIP archive upload

Upload the ZIP file as a single `files[]` entry. The platform extracts and processes each entry separately. Hostile ZIP structures (nested archives, path traversal, disguised executables) are rejected automatically with recorded reasons.

### 2.3 Checking upload progress

```
GET /api/research/uploads/:batch_id
```

Returns per-file status: `PENDING`, `INGESTED`, `DUPLICATE`, `REJECTED`, or `DEAD_LETTER`.

**DUPLICATE** means a byte-identical file was already ingested (same SHA-256). The duplicate is recorded but not re-processed.

**DEAD_LETTER** means this file failed after all retry attempts. Check `error_report` for the reason.

---

## 3. Rights Triage

Every ingested container starts as `UNREVIEWED` and cannot be processed further until a rights reviewer makes a decision. This is mandatory — it is not a formality.

### 3.1 Rights review queue

```
GET /api/research/review-items?status=open
```

Each item describes a container awaiting a rights decision.

### 3.2 What to tell the rights reviewer

For each upload batch, provide:
- The source of the documents (court website, publisher, private holder)
- The date the documents were obtained
- Whether written permission or licence exists, and where it is filed
- Any known restrictions (e.g. "do not share externally", "internal research only")

The rights reviewer will record a formal decision using the 17-field rights record. See the rights-review manual for their procedure.

### 3.3 What happens after rights approval

Once the rights reviewer records a decision, the container transitions to `RIGHTS_APPROVED` and the system automatically queues it for inventory and extraction. No further action is needed from you.

---

## 4. Extraction

Extraction runs automatically after rights approval. You do not need to trigger it manually.

### 4.1 Digital (text-based) PDFs

The platform extracts text natively using poppler, preserving reading order, text blocks, and character offsets.

### 4.2 Scanned PDFs

Scanned pages are processed through the OCR engine (Tesseract, English + Malay). Low-quality pages (confidence <70%) are automatically flagged and routed to `OCR_REVIEW_REQUIRED`.

### 4.3 OCR Review Required

If a container enters `OCR_REVIEW_REQUIRED`:

```
GET /api/research/containers/:id/review-ui
```

This renders the review interface showing the scanned page image, the OCR text, confidence scores, and any warnings. Staff with the appropriate role can:
- Add a correction (append-only — the original OCR output is never overwritten)
- Mark the page as reviewed

After all pages are resolved, the container re-enters the extraction pipeline.

---

## 5. Segmentation

After extraction, the platform automatically runs the segmentation engine. This detects how many legal cases are in each container (zero, one, or many).

### 5.1 Normal outcomes

| State | Meaning |
|-------|---------|
| SEGMENTATION_PROPOSED | Segmentation completed; candidates proposed for review |
| SEGMENTATION_REVIEW_REQUIRED | One or more boundaries are uncertain; human review needed |

### 5.2 When human review is needed

Containers in `SEGMENTATION_REVIEW_REQUIRED` must be reviewed by a segmentation reviewer. See the segmentation-review manual.

---

## 6. Editorial Review

After segmentation review, the platform runs an editorial classification pass to separate judicial text from publisher editorial material (headers, page numbers, running titles, publication notices).

| State | Meaning |
|-------|---------|
| EDITORIAL_REVIEW_PENDING | Screening in progress |
| EDITORIAL_REVIEW_REQUIRED | Uncertain sections found; human review needed |
| JUDGMENT_VERIFICATION_PENDING | Ready for final human verification |

---

## 7. Judgment Verification

The final step before a container becomes part of the verified corpus. A legal reviewer inspects the isolated judicial text, confirms completeness (opening citation, court, grounds, closing order), and promotes the candidate to a `research_verified_judgments` record.

See the legal-review manual for the reviewer's procedure.

---

## 8. Common Error States and Recovery

| Error state | Likely cause | Action |
|-------------|-------------|--------|
| DEAD_LETTER (batch item) | Staging failure, checksum error | Check error_report; re-upload if transient |
| QUARANTINED | Rights or integrity problem flagged | Notify rights reviewer; do not touch |
| PROCESSING_BLOCKED | Admin halt | Contact administrator |
| SEGMENTATION_REVIEW_REQUIRED | Ambiguous boundaries | Route to segmentation reviewer |
| OCR_REVIEW_REQUIRED | Low scan quality | Review and correct via review UI |
| BLOCKED_BY_RIGHTS (job) | Rights status changed after queuing | Trigger a new rights review |
| FAILED_PERMANENT (job) | Non-retryable failure | Check failure_reason; notify administrator |

---

## 9. When to Escalate

Escalate to the **rights reviewer** when:
- The source of a document is unclear or disputed
- A document may be subject to commercial publisher rights
- You receive a takedown request or legal notice about a document

Escalate to the **legal reviewer** when:
- A document may be subject to a court order
- A document contains sensitive information beyond normal judgment content

Escalate to the **administrator** when:
- The platform is not processing jobs (queue appears stuck)
- A container is in an unexpected state
- You cannot access a container you uploaded
