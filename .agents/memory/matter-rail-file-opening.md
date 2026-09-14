---
name: Matter rail file opening
description: Security and routing convention for opening private saved outputs and source documents from shared portal UI.
---

Private matter-rail files must open through matter-scoped API routes using the host portal's authenticated request adapter. Do not expose object-storage paths or treat API endpoints as artifact-internal navigation links.

**Why:** The portals use different authentication mechanisms, while Vite artifact base-path rewriting is correct for UI routes but wrong for root API routes. A shared authenticated request keeps credentials and tenant checks intact across every portal.

**How to apply:** Put open/download endpoints beneath the owned matter API, re-check both owner and matter linkage, and let shared UI fetch through its supplied request function. Only safe content types may render inline; force all other bytes to download.