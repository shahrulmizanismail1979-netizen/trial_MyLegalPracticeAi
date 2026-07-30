# Risk Register — Judgment Research Platform

**Last updated:** 2026-07-30  
**Review cycle:** Quarterly, or after any P1/P2 incident  
**Owner:** Platform owner

Likelihood: H = High (likely within 12 months), M = Medium (possible), L = Low (unlikely but plausible)  
Impact: H = Significant data loss, breach, or operational halt; M = Degraded service or recoverable error; L = Minor, contained, quickly recoverable

---

## Active Risks

| ID | Risk | Likelihood | Impact | Current Mitigations | Residual Risk | Owner | Review Date |
|----|------|-----------|--------|--------------------|----|-------|-------------|
| R-01 | **Unauthorised document access (upload ownership gap)** — A staff member with an operational role accesses documents uploaded by another staff member before rights review. Task #7 is unresolved. | H | H | All routes require staff authentication; rights model restricts UNREVIEWED to rights roles only; audit trail records all access | M — rights model provides a secondary barrier, but the ownership check is missing | Developer | On resolution of Task #7 |
| R-02 | **Cross-subscriber AI chat data exposure** — Corp subscribers from different organisations may be able to read each other's AI chat histories under certain conditions. Task #21 is unresolved. | M | H | Chat routes require authentication; Clerk sessions are scoped to individual accounts | M | Developer | On resolution of Task #21 |
| R-03 | **Rights mis-classification** — A document is cleared with the wrong rights status (e.g. commercial publisher content cleared as official court source), leading to unlicensed use. | M | H | 17-field rights record with mandatory reviewer identity; append-only history; rights changes write audit events; rights caps enforced at data layer regardless of role | M — human error in rights review is possible; mitigated by the structured record format | Rights reviewer / Owner | 2026-10-30 |
| R-04 | **OCR error propagation** — OCR extraction produces incorrect text that is not caught by the 70% confidence threshold, leading to incorrect search results or mis-segmentation. | M | M | Confidence threshold routes low-quality pages to human review; append-only correction history; segmentation coherence checks detect structural anomalies; isolation gate does not remove OCR uncertainty | M — real-corpus calibration of the threshold is not yet done | Developer | After first real-corpus batch |
| R-05 | **Segmentation error — missed or incorrect boundary** — The segmentation engine incorrectly merges two judgments or splits one judgment. | M | M | 18 coherence checks per candidate; SEGMENTATION_REVIEW_REQUIRED routing for uncertain results; human review of all candidates; cross-file relationship detection | L — multiple automated and human gates catch errors before verification | Segmentation reviewer | 2026-10-30 |
| R-06 | **External AI exposure of restricted content** — A restricted container's text is submitted to an external AI provider in violation of the rights model. | L | H | AI adapter disabled by default; enabling requires an explicit ADR; external AI gate structurally refuses EXTERNAL_AI_RESTRICTED and DO_NOT_PROCESS containers; no external AI calls in current code | L — structural gate makes this unlikely in current configuration | Developer | On any AI enablement |
| R-07 | **Publisher-content leakage into search index** — Publisher editorial material (headnotes, page numbers, running titles) enters the search index, polluting search results or creating copyright exposure. | L | M | Phase 07 isolation gate enforced structurally at index time; only VERIFIED_JUDICIAL_TEXT and PROBABLE_JUDICIAL_TEXT sections enter the index; isolation is non-destructive (originals retained, audit trail) | L — isolation gate is tested and golden-pinned | Developer | 2026-10-30 |
| R-08 | **Data loss — no automated backup** — A database or object storage failure results in data loss because no automated backup verification is in place. | M | H | Manual backup procedure documented; Replit infrastructure provides some durability; original files retained in private object storage | M — manual procedures are error-prone and may be skipped under operational pressure | Administrator | 2026-09-30 |
| R-09 | **Single-point infrastructure failure** — The Replit deployment fails or becomes unavailable, taking the entire platform offline. | M | M | Replit deployment provides managed availability; restoration procedure documented; data stored in managed PostgreSQL and object storage | M — no multi-region failover; RTO is hours, not minutes | Administrator | 2026-10-30 |
| R-10 | **Job-stealing between parallel workers** — Two parallel test workers (or future production workers) claim the same job simultaneously, leading to duplicate processing or data corruption. Task #87 is unresolved. | L | M | `FOR UPDATE SKIP LOCKED` atomic job claiming prevents double-processing at the database level; no parallel workers in current production configuration | L — test coverage gap but production is single-worker | Developer | On resolution of Task #87 |
| R-11 | **Operational error — accidental deletion** — An administrator runs a `DO_NOT_RETAIN` decision or a destructive migration on the wrong container or environment. | L | H | `DO_NOT_RETAIN` requires a formal rights decision with reviewer identity; audit trail is append-only; destructive migrations require explicit ADR and user approval; rollback procedure documented | L — process controls reduce likelihood; recovery is possible from backup within RPO | Administrator | 2026-10-30 |
| R-12 | **Full-corpus scale failure** — The platform cannot handle the full corpus volume (hundreds of containers, thousands of pages, many candidates) within acceptable time. | M | M | Stress test suite (`stress.test.ts`) exists; pilot ran 6 containers successfully; job queue is database-backed and horizontally scalable in principle | M — formal capacity test against production corpus size not yet completed | Developer | Before full-corpus import |

---

## Closed Risks

| ID | Risk | Closed Date | Resolution |
|----|------|------------|------------|
| RC-01 | **Pilot false-pass** — Report generator could pass the acceptance gate with no data | 2026-07-30 | Fixed: acceptance gate now fails INCONCLUSIVE when mandatory evidence is absent (Task #83) |
| RC-02 | **Editorial job infinite loop** — Bad editorial jobs looped forever when processor not registered | 2026-07-30 | Fixed: loop prevention implemented (Task #86) |
| RC-03 | **FK cascade violations in test cleanup** — Test afterAll deleting rows in wrong FK order caused test failures | 2026-07-30 | Fixed: coherence checks deleted before validation runs (Task #83) |
