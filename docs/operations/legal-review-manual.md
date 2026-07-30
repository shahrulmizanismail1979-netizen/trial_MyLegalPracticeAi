# Legal-Review Manual — Judgment Research Platform

**Audience:** Staff with `legal_reviewer`, `administrator`, or `owner` roles  
**Purpose:** Guide for reviewing containers that require legal sign-off before processing  
**Last updated:** 2026-07-30

---

## 1. What Is Legal Review?

Some containers are flagged `MANUAL_LEGAL_REVIEW_REQUIRED` — meaning a lawyer must assess them before any processing occurs. While in this status, the container is treated identically to `DO_NOT_PROCESS`: it cannot be extracted, segmented, displayed, searched, or exported. Only rights-privileged roles can see its metadata.

Containers reach `MANUAL_LEGAL_REVIEW_REQUIRED` when:
- The inventory analyzer detects indicators of commercial publisher content and the automated triage cannot resolve the ambiguity
- A rights reviewer escalates a container because its provenance or licensing is unclear
- A staff member reports potential concerns (e.g. received a copyright notice, document may be subject to a court suppression order)

---

## 2. Your Review Queue

```
GET /api/research/review-items?status=open&kind=legal_review
```

Each item shows:
- Container ID and original filename
- Source batch and upload date
- The escalation reason or inventory finding that triggered the flag
- The provenance information recorded at upload

---

## 3. The Review Decision Procedure

### Step 1 — Read the provenance

Before viewing any document content, read the provenance metadata:
- Where did this document come from?
- Who uploaded it and when?
- Is there a written licence or permission on file?
- What did the inventory analyzer flag?

### Step 2 — Assess the legal position

Consider:
1. **Copyright status** — Is this a commercial publisher's version of a judgment (with their editorial additions), or a court-issued document? Publisher versions typically cannot be used without a licence.
2. **Court orders** — Is this document subject to any order restricting disclosure (e.g. anonymisation order, suppression order, in-camera order)?
3. **Personal data** — Does the document contain personal data that should not be indexed or made searchable (e.g. under data protection law or a court direction)?
4. **Consent** — If submitted by a user, do they have the rights to authorise our use?

### Step 3 — Record your decision

Your decision is recorded as a 17-field rights record. The mandatory fields for a legal review decision are:

| Field | What to enter |
|-------|--------------|
| source | Where the document came from (URL, publisher, court portal, etc.) |
| date_obtained | When the organisation received or downloaded it |
| declared_source_type | `official_court` / `commercial_publisher` / `user_owned_or_authorised` / `unknown` |
| licence_reference | File reference for any written permission or licence; null if none |
| approved_users | List of email addresses permitted to access this container |
| approved_purposes | e.g. `["research", "training"]` |
| storage_permitted | true / false |
| analysis_permitted | true / false |
| external_processing_permitted | **Almost always false** for legal review |
| student_access_permitted | true / false |
| printing_permitted | true / false |
| export_permitted | true / false |
| retention_period | Days the document may be retained; null if indefinite |
| expiry_date | Date at which the rights record expires; null if no expiry |
| reviewer | Your email address |
| review_date | Today's date |
| notes | Plain-language summary of your legal reasoning |

### Step 4 — Submit the decision

```
POST /api/research/containers/:id/rights-decision
Authorization: (legal_reviewer session)
Body: {
  "status": "<chosen status from table below>",
  "source": "...",
  "dateObtained": "2026-07-01",
  ... (all 17 fields)
}
```

### Step 5 — Verify the outcome

After submission, confirm the container's `rights_status` has updated and an audit event has been recorded:
```
GET /api/research/containers/:id/rights-records
```

---

## 4. Rights Statuses You Can Assign

| Status | Use when |
|--------|----------|
| `PRIVATE_PROCESSING_APPROVED` | Court-sourced or licensed; internal research use permitted; no external sharing |
| `OFFICIAL_COURT_SOURCE` | Document obtained from official court portal or directly from the court |
| `PUBLIC_OR_OPEN_LICENCE_SOURCE` | Genuinely public domain or open licence confirmed |
| `USER_OWNED_OR_AUTHORISED` | Submitted by the rights holder or with documented authorisation |
| `DISPLAY_RESTRICTED` | Can be processed internally but must not be displayed, printed, or exported |
| `ANALYSIS_RESTRICTED` | Can be viewed but must not be analysed, searched, AI-processed, or exported |
| `EXTERNAL_AI_RESTRICTED` | Full internal processing; must never be submitted to any external AI |
| `EXPORT_RESTRICTED` | Full internal processing; must not be exported, printed, or shared |
| `DO_NOT_PROCESS` | Confirmed cannot be processed; metadata visible to rights roles only |
| `DO_NOT_RETAIN` | Must not be retained; triggers immediate deletion workflow |
| `MANUAL_LEGAL_REVIEW_REQUIRED` | Escalate to another legal reviewer (use only if you have a genuine conflict or need a second opinion) |

---

## 5. Escalation and Recusal

If you have a conflict of interest (e.g. the document relates to a client matter you were involved in), you must:
1. Recuse yourself — do not view the document content
2. Record a note in the review item: "Recused — conflict of interest; reassign to [name]"
3. Notify the administrator to reassign the review item

If the legal position is genuinely unclear and requires senior legal advice:
1. Set the status to `DO_NOT_PROCESS` as a precautionary measure
2. Record detailed notes explaining the uncertainty
3. Notify the platform owner and the referring staff member

---

## 6. After Your Decision

If you set a permissive status (e.g. `PRIVATE_PROCESSING_APPROVED`), the container will automatically proceed to extraction and segmentation. You do not need to trigger this.

If you set `DO_NOT_RETAIN`, the container immediately routes to `DELETION_PENDING`. This is irreversible through the application (the deletion service will execute it). Confirm you intend deletion before submitting.

If you set `DO_NOT_PROCESS`, the container is halted indefinitely. It can only proceed after a subsequent rights decision by a rights reviewer or legal reviewer.

---

## 7. Judgment Verification

At the end of the pipeline, some containers will reach `JUDGMENT_VERIFICATION_PENDING`. At this stage, the platform has:
- Extracted the text
- Segmented it into case candidates
- Isolated and removed publisher editorial content

Your role at this stage is to confirm that the judicial text is complete and accurate:
1. Review the isolated judicial text via `GET /api/research/containers/:id/judicial-text`
2. Check that the opening citation, court, parties, grounds, and closing order are all present
3. If complete, approve via `POST /api/research/containers/:id/verify`
4. If incomplete or incorrect, reject and note the issue — the container will route to `EDITORIAL_REVIEW_REQUIRED`

Verification creates a `research_verified_judgments` record, which is the platform's assertion that this text faithfully represents the original judicial document.
