# Specialist portals — AI task-completion audit

Scope: MyAccidentAI, MyConveyLitAI, MyCCBLitAI, MyLawFirmAI, and MyLawAcad only.  
Method: frontend and corresponding API route inspection plus provider-free unit tests. No provider calls, migrations, secrets, workflow changes, or backend edits were made.

## Status key

- **Verified** — frontend behavior was checked against the actual backend response/error contract; where changed, an isolated regression check covers the completion boundary.
- **Inspected** — source contract and handling were reviewed and no completion/save/export defect was confirmed.
- **Unverified** — requires an authenticated browser or real external provider and was deliberately not claimed by this audit.
- **Blocked** — unavailable external integration; not an implementation-completion result.

## MyAccidentAI

| Feature | Contract and result |
|---|---|
| AI legal chat | **Verified.** `POST /api/accident/ai/chat` is non-stream JSON `{reply}` with non-2xx JSON errors. The UI now rejects a 200 response whose required text is absent/blank instead of displaying a synthetic “(no response)” answer. |
| AI case analyzer | **Verified.** `POST /api/accident/ai/analyze-case` is non-stream JSON `{analysis}`. Blank/missing analysis can no longer become a saveable/exportable placeholder. |
| Demand-letter drafter | **Verified.** Non-stream JSON `{letter}`; required output is checked before save/export UI is enabled. |
| Written-submissions drafter | **Verified.** Non-stream JSON `{submissions}`; required output is checked before save/export UI is enabled. |
| Live provider/browser completion | **Unverified.** No real provider or authenticated browser request was used. |

Regression coverage: `src/lib/ai-response.test.ts` checks valid completion and null, missing, blank, whitespace, and wrong-type 200 payloads.

## MyConveyLitAI

| Feature group | Contract and result |
|---|---|
| Tutor chat and the 38 AI tools in `AIPanel` (drafting, risk/checklist/deadlines, SPA review/comparison/title interpretation, quotations/letters/due diligence/opinion/requisition/completion, research/calculations, tenancy/POA/caveat/search/claims, compliance/training, and corporate property documents) | **Inspected.** Corresponding `/api/convey/*` routes return complete non-stream JSON with a feature-specific text field and non-2xx JSON on failure. Generated mutations reject non-2xx responses; handlers only install new result text after the JSON promise resolves. No transport-partial result can reach save/export. |
| Existing completed output after a failed regeneration | **Inspected.** It remains the prior completed result, not bytes from the failed request. No confirmed partial-output bug. |
| Save-to-matter and DOCX/PDF/text/Markdown/Google Docs actions | **Inspected.** Actions are rendered from resolved result state rather than a streaming buffer. |
| Live provider, Google Docs, and authenticated browser completion | **Unverified.** External/provider calls and browser E2E were outside this isolated audit. |

No frontend change was required.

## MyCCBLitAI

| Feature | Contract and result |
|---|---|
| Legal AI chat | **Verified.** The backend sends SSE over HTTP 200, persists the assistant message only after generation, then emits `{done:true}`; in-stream failures emit `{error}`. The frontend now buffers across arbitrary chunk boundaries and treats the explicit terminal event as completion before refreshing canonical messages. |
| Generic AI tools | **Verified.** `/api/ccb/tools/generate` has the same SSE `{content}` → `{done:true}` / `{error}` contract. Previously an error, abort, or truncated stream could leave partial text eligible for save/export. Partial text is now visibly marked incomplete and cannot be saved or exported. |
| AI case strategy planner | **Verified.** Uses the same endpoint/contract and now has the same completion gate. Its old chunk-local parser could also lose split JSON events; this is fixed. |
| Conversation deletion | **Not touched.** Explicitly owned by another worker. No CCB backend file was changed. |
| Live Gemini/browser completion | **Unverified.** No real provider request was made. |

Regression coverage: `src/lib/completion-stream.test.ts` checks split transport chunks, successful terminal completion, error-after-partial, and EOF-before-terminal behavior with in-memory streams only.

## MyLawFirmAI

| Feature | Contract and result |
|---|---|
| AI manager briefing | **Inspected.** Non-stream JSON; provider errors become HTTP 502 JSON and the mutation error branch suppresses result presentation. |
| AI task triage, AI goal builder, meeting transcription/summary, and task-draft creation | **Inspected.** Generated mutation contracts use complete JSON and reject non-2xx responses. Draft exports/task creation operate on resolved drafts. |
| Voice instruction drafting | **Verified (frontend stale-result handling).** Starting a new parse now removes the previous completed result, so a failed new recording cannot leave the old assistant reply/draft looking like the new completion. Backend validation/provider failures are non-2xx JSON. |
| ElevenLabs-dependent voice capability | **Blocked.** Missing ElevenLabs availability is an external integration blocker, not implementation completion. Nothing was installed or reconnected. |
| Live transcription/provider and export integrations | **Unverified.** No provider, Drive, or browser E2E call was made. |

## MyLawAcad

| Feature | Contract and result |
|---|---|
| AI exam blueprint and suggested rules | **Inspected.** Non-stream schema-validated JSON; mutation failures are displayed and do not apply partial form state. |
| AI question generation and regrading (single and bulk) | **Inspected.** Non-stream JSON/status contracts. Editor handlers report mutation errors; bulk regrade counts every non-2xx/network failure and reports mixed failure. |
| Candidate next-question generation | **Inspected.** First-question failure has retry UI. Generated mutation contracts reject malformed/non-2xx responses. |
| Candidate AI answer grading | **Verified (failure handling).** The non-stream grading response is only installed on success. A failed submission now shows an explicit inline error and leaves the answer editable/retryable instead of silently returning to the submit button. |
| Studio answer submission, manual override, and sign-off | **Inspected.** Complete JSON mutation contracts; no stream/partial export path was found. |
| Live grading/provider and authenticated browser completion | **Unverified.** No real provider or exam E2E was used. |

## Validation

Executed under `/tmp/workspace-completion-validation.lock` with one Vitest worker:

- 2 test files, 9 tests passed.
- Typecheck passed for all edited portals: MyAccidentAI, MyCCBLitAI, MyLawFirmAI, and MyLawAcad.
- MyConveyLitAI was inspection-only and was not edited.