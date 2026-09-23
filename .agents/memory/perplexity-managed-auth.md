---
name: IRAC provider choice
description: User-approved OpenAI default and Claude replacement, scoped to IRAC.
---

IRAC defaults to OpenAI, with Claude replacing the optional Perplexity choice and Gemini remaining available. Keep other portals' existing provider defaults unchanged.

**Why:** On 2026-09-23 the user approved replacing Perplexity with Anthropic, but explicitly preferred OpenAI as default. This supersedes the earlier managed-Perplexity repair decision. The agreed scope was IRAC, not a global change to every portal.

**How to apply:** Preserve valid personal overrides and later admin choices. Never silently select another provider on a generation failure. Claude/OpenAI text without retrieval must not be described as live-source-verified legal research.