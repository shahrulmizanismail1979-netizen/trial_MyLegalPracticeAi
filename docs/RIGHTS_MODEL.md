# Rights Model — Judgment Research Platform

Every source container carries a rights status. Access and processing depend
on it. **All source files begin as `UNREVIEWED`.**

## Rights Statuses

| Status             | Meaning                                     | Allowed processing                                                                                                                      |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `UNREVIEWED`       | Default on ingest. Rights not yet assessed. | Registration, checksum, duplicate detection, staging to private storage. No extraction, indexing, embedding, AI, or display of content. |
| `CLEARED_INTERNAL` | Cleared for internal research use.          | Full internal pipeline (extraction, segmentation, search, review). No external exposure.                                                |
| `RESTRICTED`       | Rights review found restrictions.           | Container metadata visible to staff; content processing frozen; items routed to review for disposition.                                 |
| `EXCLUDED`         | Must not be used.                           | No processing; content quarantined; retained only for audit or deleted per decision record.                                             |

Transitions are made only by human reviewers and are recorded as
transformations (`research_transformations`, kind `rights_change`) with the
reviewer identity.

## Enforcement Rules

1. The database default is `UNREVIEWED`; no code path may insert a container
   with a more permissive status.
2. Repositories and job handlers must check rights status before touching
   container content. A handler that encounters an insufficient status fails
   the job with a recorded reason and routes a review item — it never guesses
   or proceeds.
3. Publisher/editorial material identified inside a container inherits the
   container's rights status but is additionally isolated from indexes,
   embeddings, summaries, AI prompts, classifications, and citation analysis
   regardless of rights status.
4. Rights statuses are never downgraded silently: every change is a
   reviewable transformation.
