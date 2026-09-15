---
name: Matter rail file opening
description: Security and routing convention for opening private saved outputs and source documents from shared portal UI.
---

Private matter-rail files must open through matter-scoped API routes using the host portal's authenticated request adapter. Do not expose object-storage paths or treat API endpoints as artifact-internal navigation links.

**Why:** The portals use different authentication mechanisms, while Vite artifact base-path rewriting is correct for UI routes but wrong for root API routes. A shared authenticated request keeps credentials and tenant checks intact across every portal.

**How to apply:** Put open/download endpoints beneath the owned matter API, re-check both owner and matter linkage, and use the supplied request function to authorize a native download rather than fetching file bytes into a Blob. Only safe content types may render inline on legacy open routes; force all other bytes to download.

Prefer native attachment downloads for rail files, including otherwise inline-safe documents.

**Why:** Removing JavaScript Blob buffering alone does not prevent a large PDF or media viewer from consuming browser memory. A short-lived, exact-file handoff lets the browser download manager handle bytes without rendering them. Keep authorization live at redemption rather than treating the handoff as a replacement for owner checks.

**How to apply:** Preserve legacy inline routes for their existing callers, but keep rail downloads attachment-only. Do not place reusable portal credentials in download URLs or bypass portal middleware.