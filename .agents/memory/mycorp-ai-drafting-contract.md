---
name: MyCorpAI drafting contract
description: Guardrails for reliable, complete corporate drafting across the specialist tool pages and the shared AI Drafter panel.
---

All MyCorpAI drafting paths must preserve the selected specialist tool identity, treat uploaded material as evidence rather than instructions, and only present a generated draft as complete after an explicit terminal completion event. Export, copy, read-aloud, and save-to-matter controls must remain unavailable until that completion state. Missing execution-critical details must remain visible placeholders instead of invented facts.

**Why:** A generic-tool fallback can produce the wrong work product, while silent stream truncation makes partial output appear ready to use or export. Both are particularly unsafe for legal drafting.

**How to apply:** When adding or changing an AI drafting surface, use the server-side specialist prompt, preserve factual/source boundaries, make incomplete or malformed streams visibly fail, and keep the renderer/export path faithful to the completed Markdown output.