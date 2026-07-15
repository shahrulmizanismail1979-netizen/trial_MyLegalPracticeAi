---
name: Contribution anonymization pipeline
description: Privacy rules for the public contribution knowledge base and lessons on LLM anonymization output handling.
---

## Rules
- The public knowledge-base endpoints must only ever serve `anonymizedText`; raw `extractedText` and original uploaded files are staff-only (originals contain real client names/NRIC/etc.).
- LLM anonymiser must return strict JSON (`response_format: json_object`) with `anonymizedText` + `replacements`; hard-fail on any parse deviation — never store output that might still contain originals.
- **Why:** delimiter-based stripping ("===MAPPING===") of model output was flagged as a critical PII leak risk in review — LLM formatting drift can leave original names in publicly served text.
- **How to apply:** any future pipeline that asks a model to emit sensitive mapping data must use structured output + a post-generation leak guard (check no `original` values remain in the stored text), and status writes must be race-safe (never downgrade `done` → `failed`).

## Prod deploy note
Schema changes here were applied to dev via direct SQL ALTER TABLE (drizzle push prompts interactively on an unrelated corp_access_codes constraint). Prod needs the same ALTER TABLE at deploy time.
