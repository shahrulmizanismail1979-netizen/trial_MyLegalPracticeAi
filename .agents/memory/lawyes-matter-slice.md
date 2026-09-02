---
name: LAWYes first matter slice
description: Security and data-source decisions for the unified LAWYes matter workspace
---

The first real LAWYes vertical slice is a MyLitAI matter workspace. Treat the numeric MyLitAI access-code ID as the tenant, and use the same canonical shared matter stores as the portal for documents, tasks, events, and versioned drafts. Every supporting query needs portal, owner key, and matter ID predicates in addition to the initial matter-ownership gate.

**Why:** A matter ID alone does not establish tenant ownership, and parallel or approximate stores can omit records the lawyer already sees in MyLitAI. MyLitAI conversations are tenant-scoped but have no matter association, so placing all firm conversations into every matter—or guessing from numeric IDs—would disclose unrelated work.

**How to apply:** Extend LAWYes by reusing the selected portal’s auth and canonical matter records. Leave unlinked categories empty rather than infer ownership or association; add an explicit, owner-verified matter link before showing conversations in a matter.