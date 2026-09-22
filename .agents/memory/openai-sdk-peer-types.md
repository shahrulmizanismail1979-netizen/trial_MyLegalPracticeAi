---
name: OpenAI SDK peer type identity
description: Keep a single SDK type identity when supporting direct and proxied OpenAI clients.
---

Use one locally resolved OpenAI constructor for both direct and proxy configuration when workspace SDK imports resolve through different peer dependency trees.

**Why:** pnpm can install the same SDK version against different Zod peers. Its private client members then have incompatible nominal types; returning a union also makes overloaded completion methods uncallable.

**How to apply:** Preserve explicit direct-key precedence and use the existing integration URL/key for proxy configuration, without changing providers or broadly relinking dependencies. Avoid unsafe casts that merely hide the SDK identity mismatch.