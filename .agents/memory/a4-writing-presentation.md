---
name: A4 writing presentation
description: Cross-portal writing presentation and download requirements without destructive source changes.
---

Generated writing must display as an A4-style document without visible ASCII asterisks, with consistent multi-format downloads across LAWYes and specialist portals.

**Why:** The user explicitly requested this across the website while protecting working features. Rewriting persisted source would risk changing saved legal work, revision history and reviewed cloud-export snapshots.

**How to apply:** Normalize Markdown at presentation/export boundaries only; retain original stored text, editing state, completion gates, metadata, permissions and reviewed cloud-export approvals. Never silently replace unsupported PDF glyphs with corrupted text; provide a clearly explained Unicode-safe print path if direct PDF fonts cannot represent the document.