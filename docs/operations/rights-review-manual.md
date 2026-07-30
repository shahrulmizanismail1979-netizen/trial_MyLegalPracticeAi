# Rights-Review Manual — Judgment Research Platform

**Audience:** Staff with `rights_reviewer`, `administrator`, or `owner` roles  
**Purpose:** Complete guide to rights assessment and status decisions  
**Last updated:** 2026-07-30

---

## 1. Your Role

Rights reviewers are the gatekeepers of the platform. **No document can be processed until a rights decision is recorded.** Every source container begins as `UNREVIEWED` — a state that permits storage only. Until you act, the document is visible only to rights-privileged roles and cannot be extracted, segmented, searched, or exported.

Your decision is permanent and audited. Every change appends a rights record to the immutable history — you cannot delete or overwrite a prior decision. A new decision supersedes the previous one, but the history is always visible.

---

## 2. Opening Your Queue

```
GET /api/research/review-items?status=open
```

Each item shows the container, the reason it needs review, and the provenance metadata captured at upload.

For containers in `QUARANTINED`, your decision determines whether to release or dispose of them:
```
GET /api/research/containers?state=QUARANTINED
```

---

## 3. The 13 Rights Statuses — Plain Language

### Fully permissive (proceed with all processing)

| Status | Plain meaning |
|--------|--------------|
| `OFFICIAL_COURT_SOURCE` | We got this directly from the court. Full use permitted. |
| `PUBLIC_OR_OPEN_LICENCE_SOURCE` | This is in the public domain or under an open licence confirmed in writing. Full use permitted. |

### Conditionally permissive (proceed with constraints)

| Status | Plain meaning |
|--------|--------------|
| `PRIVATE_PROCESSING_APPROVED` | Cleared for full internal research. No external sharing, no public URLs. |
| `USER_OWNED_OR_AUTHORISED` | The person who uploaded it owns it or has written permission. Internal use only; no public sharing. |
| `DISPLAY_RESTRICTED` | Can be processed and analysed internally, but staff must not display, print, export, or share it. Analysis only. |
| `ANALYSIS_RESTRICTED` | Can be viewed by authorised staff, but must not be analysed, searched, AI-processed, or exported. |
| `EXTERNAL_AI_RESTRICTED` | Full internal processing, but must never leave our system for any external AI or cloud processor. |
| `EXPORT_RESTRICTED` | Full internal processing, but must not be exported, downloaded, printed, or shared with anyone outside the platform. |

### Restrictive (minimal or no processing)

| Status | Plain meaning |
|--------|--------------|
| `COMMERCIAL_SOURCE_REVIEW_REQUIRED` | We suspect this came from a commercial publisher. Do not process until rights are confirmed. |
| `DO_NOT_PROCESS` | Confirmed cannot be used. Metadata visible to rights roles only; no other access. |
| `DO_NOT_RETAIN` | Must not be kept at all. Triggers immediate deletion. Use only when legally required to destroy. |
| `MANUAL_LEGAL_REVIEW_REQUIRED` | A lawyer must decide. Treated as DO_NOT_PROCESS until the legal reviewer acts. |
| `UNREVIEWED` | Default on ingest. Do not assign this — it is the starting state only. |

---

## 4. The Capability Matrix

This table shows what each status permits. **Your role can never override these caps.**

| Status | Display | Search | Analysis | External AI | Export | Print | Student access |
|--------|---------|--------|----------|-------------|--------|-------|----------------|
| OFFICIAL_COURT_SOURCE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PUBLIC_OR_OPEN_LICENCE_SOURCE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PRIVATE_PROCESSING_APPROVED | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| USER_OWNED_OR_AUTHORISED | ✅ | ✅ | ✅ | ❌ | ✅* | ✅ | ✅ |
| DISPLAY_RESTRICTED | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| ANALYSIS_RESTRICTED | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| EXTERNAL_AI_RESTRICTED | ✅ | ✅ | ✅ | ❌ | ✅* | ✅ | ✅ |
| EXPORT_RESTRICTED | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| COMMERCIAL_SOURCE_REVIEW_REQUIRED | Rights roles only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| MANUAL_LEGAL_REVIEW_REQUIRED | Rights roles only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DO_NOT_PROCESS | Rights roles only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DO_NOT_RETAIN | Rights roles only | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

*Export also requires `exportPermitted = true` explicitly set in the rights record.

---

## 5. Recording a Rights Decision

### 5.1 The 17-field rights record

Every decision must complete these fields:

| # | Field | Notes |
|---|-------|-------|
| 1 | source | URL, organisation name, or "Submitted by [name]" |
| 2 | dateObtained | When the organisation received the document |
| 3 | declaredSourceType | `official_court` / `commercial_publisher` / `user_owned_or_authorised` / `open_licence` / `unknown` |
| 4 | licenceReference | File reference or URL for written permission; null if none |
| 5 | approvedUsers | Who may access this container (email list or role) |
| 6 | approvedPurposes | e.g. `["research"]`, `["research", "teaching"]` |
| 7 | storagePermitted | true / false |
| 8 | analysisPermitted | true / false |
| 9 | externalProcessingPermitted | Almost always false for internal research |
| 10 | studentAccessPermitted | true / false |
| 11 | printingPermitted | true / false |
| 12 | exportPermitted | true / false |
| 13 | retentionPeriod | Days; null if indefinite |
| 14 | expiryDate | Date the record expires; null if no expiry |
| 15 | reviewer | Your email address |
| 16 | reviewDate | Today's date |
| 17 | notes | Summary of your reasoning |

### 5.2 Submitting the decision

```
POST /api/research/containers/:id/rights-decision
Body: { "status": "PRIVATE_PROCESSING_APPROVED", ... (all 17 fields) }
```

The system will:
1. Append the rights record to the immutable history
2. Update the container's `rights_status` mirror column
3. Write an audit event and a transformation — all in one atomic transaction
4. If `DO_NOT_RETAIN`, immediately route to `DELETION_PENDING`

### 5.3 Viewing the rights history

```
GET /api/research/containers/:id/rights-records
```

Returns the full append-only history of every rights decision for this container.

---

## 6. Handling Expired Rights Records

If a container's rights record has an `expiryDate` in the past, the platform treats it as restrictive — equivalent to `UNREVIEWED`. The container will be blocked from processing and display.

When you discover an expired record:
1. Contact the person responsible for renewing the licence or permission
2. Record a new rights decision once renewal is confirmed
3. If renewal is not possible, set `DO_NOT_RETAIN` or `DO_NOT_PROCESS`

---

## 7. The DO_NOT_RETAIN Deletion Path

**Use `DO_NOT_RETAIN` only when you are legally required to destroy the document** (e.g. a court order, a rights holder's withdrawal of consent, or a data protection obligation).

When you set `DO_NOT_RETAIN`:
1. The container immediately transitions to `DELETION_PENDING`
2. No further processing can occur
3. The deletion service will execute destruction of the stored bytes and derived data
4. The `research_source_containers` row is retained with state `DELETED` and rights status `DO_NOT_RETAIN`, as required for audit trail
5. This is irreversible

Before setting `DO_NOT_RETAIN`, confirm with the platform owner or an administrator.

---

## 8. Audit Trail Obligations

Every rights decision you make is:
- Recorded with your email address and the timestamp
- Stored in `research_audit_events` (cannot be amended through the application)
- Visible to administrators and owners in the audit log

You must be accurate. If you make an error, record a corrected decision (the new one supersedes; the erroneous one remains in history with a note in your correction's `notes` field explaining what happened).

---

## 9. Common Scenarios

### "The submitter says they got this from the court website"
→ Set `OFFICIAL_COURT_SOURCE` if the official court portal is the confirmed source. Ask for the URL if you do not have it.

### "We bought a subscription to a publisher's database"
→ Check the licence agreement. Most publisher licences permit internal research but not redistribution. Typical status: `PRIVATE_PROCESSING_APPROVED` with `exportPermitted = false` and `externalProcessingPermitted = false`.

### "I'm not sure where this came from"
→ Set `COMMERCIAL_SOURCE_REVIEW_REQUIRED` to hold it. Investigate provenance before proceeding.

### "We received a takedown notice"
→ Set `DO_NOT_RETAIN` immediately. Notify the platform owner and follow the incident-response guide.
