---
name: Concurrent validation resource exhaustion
description: How to recognize and handle infrastructure-only failures when the full API and browser suites run concurrently.
---

Completion validation can run the full forked Vitest suite and Playwright browser suites at the same time. In this workspace that combination can exhaust the container's process/thread allowance: Vitest reports a worker exiting unexpectedly, while Chromium reports `pthread_create: Resource temporarily unavailable` or closes during page setup.

**Why:** These failures can occur after nearly all tests have passed and without an assertion failure. Treating them as product regressions causes unrelated code changes and still does not fix the constrained validation host.

**How to apply:** Inspect the complete validation logs first. If failures are only worker/browser launch crashes, rerun relevant suites separately (and use one browser worker when necessary). E2E fixture cleanup must use bounded, best-effort API calls plus authoritative after-suite cleanup so concurrent DB-heavy validation cannot consume the whole test timeout. Retain focused feature tests and browser evidence, and use an audited validation skip only when the configured concurrent run genuinely cannot complete.