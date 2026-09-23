---
name: Perplexity managed authentication
description: Why Perplexity uses managed connector authentication rather than the legacy direct key.
---

Use the user-authorised managed Perplexity connection; do not restore direct-key precedence as part of a general OpenAI-provider refactor. Do not silently substitute another research provider.

**Why:** The legacy direct credential was rejected. The user explicitly authorised the connector to replace that failing path. OpenAI's separate direct-key precedence decision does not apply to Perplexity.

**How to apply:** Preserve explicit provider selection, citations and completion checks. Distinguish connection discovery from a successful live generation; a connected account can still lack provider credits.