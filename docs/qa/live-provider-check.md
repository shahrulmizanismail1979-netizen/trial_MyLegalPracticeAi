# Live AI Provider Connectivity Check

## Update — 23 September 2026: authorised Perplexity connector

- The user authorised the Perplexity connection. Application requests now use the connector-managed transport instead of the rejected legacy direct key, preserving the OpenAI-compatible request/response and citation contract.
- Connection discovery succeeded. A live `sonar-pro` non-stream request using a nonsensitive public-statute prompt returned HTTP 401: `You exceeded your current quota, add credits at https://console.perplexity.ai/project/billing.`
- This supersedes the earlier invalid-key diagnosis for the active application path. Generation remains **blocked by provider quota**, not marked passed. The subsequent live streaming probe was not attempted after the first request failed.
- 11 targeted tests passed: 9 Perplexity connector/parser/failure tests and 2 existing OpenAI selection tests. These use mocked provider responses. API typecheck passed.
- API build/restart passed. Development health and provider-status routes returned HTTP 200; the latter reported the unchanged Gemini default and Perplexity connected. IRAC login rendered successfully.
- No billing action, credential disclosure, default-provider change, production publication or customer-data mutation was performed.
- Next live check requires the account owner to restore Perplexity credits. Repeating requests or reconnecting the same account does not establish that quota is restored.

The remaining sections record the earlier checks and their historical results.

**Checked:** 2026-09-22 14:36–14:43 UTC  
**Scope:** Live, non-persisting provider checks from the API server workspace.

## Safety and method

- Read the Replit AI integration, integrations, and environment/secrets guidance before checking configuration.
- Checked only whether relevant configuration entries exist; no secret value was read or printed.
- Called existing server clients directly rather than portal HTTP routes, so no conversation, message, matter, research, or other portal record was created.
- Used the harmless prompt `Return exactly QA_OK` with a very small output allowance.
- Did not send email, initiate payment, run research, generate images, or write portal/customer data. The later authorized STT check used one temporary run-owned storage object and cleaned it up.
- Did not restart a service or use a browser.

## Results

| Provider/path | Model checked | Live result | Evidence / blocker |
| --- | --- | --- | --- |
| Gemini through Replit AI Integrations | `gemini-2.5-flash` | **PASS** | Existing `@workspace/integrations-gemini-ai` client returned exactly `QA_OK`. Both required Replit-managed configuration entries exist. |
| OpenAI through Replit AI Integrations | `gpt-5.4-mini` | **PASS** | Existing `@workspace/integrations-openai-ai-server` client returned exactly `QA_OK` with finish reason `stop`. Both required Replit-managed configuration entries exist. |
| Perplexity direct API | `sonar-pro` | **FAIL — authentication** | Existing `generateChat(..., { provider: "perplexity" })` path reached Perplexity but received HTTP 401: invalid/inactive API key. The `PERPLEXITY_API_KEY` secret entry exists, but the credential is not accepted. `PERPLEXITY_MODEL` is absent, so the code default `sonar-pro` is the effective model. No new integration was provisioned. |
| IRAC OpenAI branch using its Replit fallback | `gpt-4o` default | **PASS after fix** | With no direct `OPENAI_API_KEY`, the fixed branch selected the existing Replit OpenAI client and returned exactly `QA_OK`. |

## Model IDs found in active server code

### Text generation

- Gemini/Replit: `gemini-2.5-flash`
- OpenAI/Replit: `gpt-5.4-mini`, `gpt-5.4`, and `gpt-5.2`
- Direct OpenAI IRAC branch: `OPENAI_MODEL`, defaulting to legacy `gpt-4o`
- Perplexity IRAC branch: `PERPLEXITY_MODEL`, defaulting to `sonar-pro`

The live checks validate provider connectivity with one representative model actually used by each configured text-provider path. They are not a call-by-call functional test of every feature or every model ID.

### ElevenLabs (non-text-generation QA)

The accurate state is **not “entirely absent.”**

- A direct `ELEVENLABS_API_KEY` secret is absent.
- An ElevenLabs Replit connector is currently attached.
- The existing `@replit/connectors-sdk` client successfully performed the read-only metadata request `GET /v1/voices` (HTTP 200; 24 voices returned).
- After explicit authorization for paid audio smoke checks, the shared ElevenLabs helper synthesized the nonsensitive phrase `QA OK` as a valid MP3 (16,762 bytes in the final check).
- The generated audio was passed to the existing speaker-diarized Scribe helper. It returned transcript `QA OK`, one segment, and one detected speaker.
- STT used `cloud_storage_url` staging as required by `.agents/memory/elevenlabs-stt-waf.md`; no audio bytes were sent inline through the connector. The run-owned staged object cleanup was awaited in `finally`, and the shared cleanup helper now checks the DELETE response (accepting successful deletion or already-absent 404).
- ElevenLabs model IDs referenced by server code are `eleven_turbo_v2_5`, `eleven_multilingual_v2`, and `scribe_v1`.

This means connector-backed ElevenLabs access is presently available even though a standalone direct-key secret is not configured.

## IRAC OpenAI branch fix

The problematic branch in `artifacts/api-server/src/lit/lib/aiProvider.ts` was fixed:

- An explicitly configured direct `OPENAI_API_KEY` remains the first choice and still constructs the direct client.
- When that direct key is absent, the branch now constructs the same local OpenAI SDK type with the existing Replit integration API key and base URL. This avoids cross-package nominal type conflicts while matching the shared integration client's configuration.
- `openaiConfigured()` now reports either supported configuration path accurately.
- The branch keeps its existing `gpt-4o` default and `max_tokens`/optional `temperature` request shape, preserving model compatibility.

An isolated regression test proves that the absent-direct-key case calls the configured Replit proxy rather than constructing a direct client. A second case proves an explicit direct key still wins. The targeted test completed under the shared validation lock: 1 file passed, 2 tests passed.

No other AI route or provider selection was changed.

## Follow-up blockers

1. Replace or repair the existing Perplexity credential through the secure secret/integration mechanism, then repeat the same tiny `sonar-pro` check.

Exact current Perplexity API failure remains HTTP 401: `Invalid API key provided. Ensure your API key is correct and active.` No credential was read, modified, or replaced, and no alternate research provider was selected silently.