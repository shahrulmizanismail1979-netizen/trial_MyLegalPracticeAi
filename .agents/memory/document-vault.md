---
name: Shared client document vault
description: Cross-portal document vault pattern (case_documents) — grant flow, route shapes, inline-preview XSS rule.
---

All-portal client document vault lives in the api-server case-intelligence layer (mounted once via the shared attach point, like billing/events/clients), tables keyed by `portal + owner_key`.

**Rules learned:**
- Owner-level routes mounted on a portal matter router must be ≥2 path segments (`/documents/list`, `/documents/confirm`) — a single-segment `GET /documents` is swallowed by the portal's `GET /:id` matter route. (Re-confirmed the billing-era rule; I violated it once and lists 400'd.)
- Presigned-upload grants: DB table (`case_pending_uploads`), owner+portal scoped, consumed atomically with `DELETE … RETURNING`; replayed confirms get 400 and never touch the object.
- **Inline preview is a stored-XSS vector**: uploads carry caller-controlled content types; downloads must force `Content-Disposition: attachment` + `application/octet-stream` + `nosniff` unless the type is on a strict allowlist (pdf/png/jpeg/gif/webp/plain text). UI mirrors the allowlist to hide the Preview button. **Why:** HTML/SVG served inline executes in the portal origin against another firm member's session.
- A document must always stay linked to a matter or client; PATCH must compute the post-update link pair (existing row + changes) and reject an empty pair.
- Shared UI: `@workspace/vault-ui` `DocumentsPanel` takes the same raw authenticated `request` wrapper each portal already built for billing-ui — reuse that wrapper verbatim per portal.
