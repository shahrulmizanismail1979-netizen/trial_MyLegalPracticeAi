---
name: Research platform access gating
description: Deny-by-default access rules for the judgment research module — lessons from Phase 02 review.
---

Rules that must hold for any new research endpoint or processor:

- **Role middleware alone is never enough** for container-scoped routes. Every route that touches a specific container must also run the per-container decision (`checkContainerAccess`) with record-level restrictions loaded — a rights_reviewer role gate still let quarantined-container records leak until the container check was added.
- **Deny as 404, not 403, when the caller cannot even view the container.** Returning 403 on gated ops (export, external-AI) leaks container existence. Pattern: on AccessDeniedError, re-check "view"; 403 only if view is allowed, else 404.
- **List/search filters must load record-level restrictions per item** (e.g. expired rights records), not just container-level status columns.
- **Processors fail closed**: any content-touching job without a valid numeric `containerId` throws a non-retryable failure instead of skipping the rights check. Synthetic/infra test processors opt out with `touchesContent: false`.

**Why:** architect review of Phase 02 found all four as real bypasses; deny-by-default means missing data must block, never allow.

**How to apply:** when adding research routes, jobs, or list endpoints in later phases, walk these four rules before review.
