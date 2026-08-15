---
name: Scoped large body parsers
description: How /api/lit accepts large AI-draft payloads without opening an unauth DoS surface
---
Rule: never mount a large (30mb) express.json parser on a whole portal prefix — auth endpoints would parse huge unauthenticated bodies. Mount `litHeavyJson` only on heavy sub-prefixes (forms, ai, gemini, irac, saved-work, exports, etc.) before the global ~100kb parser.
**Why:** blanket 30mb on /api/lit was flagged as an unauth memory/CPU DoS; long AI drafts legitimately exceed 100kb (tester bug: long facts silently failed drafting and save-to-matter).
**How to apply:** any new portal route carrying AI-generated documents or extracted text needs its own scoped large parser in api-server app.ts, not a global bump.

Related durable link convention: lit chronology↔deadline sync pairs rows via case_events.source = "deadline:<id>" in BOTH origination directions (event stamped after hook insert). Any new sync must keep that reciprocal stamp or edits/deletes desync.
