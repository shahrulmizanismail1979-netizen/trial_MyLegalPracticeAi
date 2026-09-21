# Specialist AI completion audit

## Confirmed fixes

- **MyCrimAI shared stream hook:** EOF, malformed SSE, cancellation, explicit stream errors, and `complete:false` no longer count as success. A response is complete only after `{"done":true}`. Partial text remains visibly labelled by the error, while save/export controls stay unavailable. A retry clears the prior response, error, and completion flag.
- **MyCrimAI task surfaces:** completion-gated save/export and automatic read-aloud now cover Legal Research, Case Analyzer, Document Drafter, Charge Analyzer, Cross-Examination, Witness Practice, Judge Practice, Sentencing, Legal Opinion, Case Strategy, and Appeal Grounds.
- **MyLitAI task streams:** the shared helper and the local Affidavits, Appeals, Banking Recovery, and Enforcement readers previously treated EOF as `onDone`. Interrupted or malformed streams now call `onError`; only an explicit terminal SSE event calls `onDone`. Their export/save controls remain hidden while generation is active or after failure.
- **MySyariahAI shared SSE consumer:** EOF and malformed/error events now reject unless an explicit `done` event was received. This prevents Case Workspace tools from transitioning interrupted partial output to `complete`. Tafsir export is also hidden after a stream failure.
- **MySyariahAI direct readers:** POST SSE responses are now guarded at the portal fetch boundary, while preserving non-SSE and metadata responses. Client Intake, Cause Papers, Compliance Check, Document Generator, Smart Search, Kitab Analysis, Legal Opinion, Analyzer, Case Analysis, Tafsir, Voice Mode, and Case Workspace therefore reject EOF without `done`. Text-output save/export/copy controls are hidden after failure. AI Counsel separately removes its partial assistant turn and shows a retryable failure.
- **MyLitAI remaining direct readers:** Forms, Draft Cause, Chambers (all 14 tools), Oral Practice, and persisted Discussions now require terminal completion. Chambers actions are gated across every tool; Oral Practice replaces a partial failed turn with a visible warning and disables transcript save; failed discussion turns are removed.
- **MyLitAI IRAC:** both the pipeline-stage stream and the enforcement stream now distinguish terminal success from malformed, provider-error, interrupted, and plain-EOF failure. `onDone` is never called for those failure states.

The matching backend routes already emit content frames followed by explicit `done` frames on successful provider completion and error frames on caught failures, so no backend change was required for these confirmed client bugs.

## Route-catalog inventory reviewed

Inventory below comes from the mounted Express route declarations, not page labels.

- **MyCrimAI:** `/ai/legal-research`, `/ai/analyze-case`, `/ai/draft-document`, `/ai/analyze-charge`, `/ai/cross-examination`, `/ai/witness-practice`, `/ai/judge-practice`, `/ai/sentencing`, `/ai/legal-opinion`, `/ai/case-strategy`, `/ai/appeal-grounds`.
- **MyLitAI general AI:** `/tutor`, `/draft-document`, `/draft-document-sync`, `/brief`, `/analyse`, `/limitation`, `/research`, `/review-pleading`, `/opinion`, `/cross-exam`, `/affidavit`, `/quantum`, `/bundle-index`, `/hearing-prep`, `/costs-estimate`, `/settlement`, `/cause-of-action`.
- **MyLitAI specialist streams:** affidavits `/draft`; appeals `/draft`; banking recovery `/draft`; enforcement `/advise`, `/bill-of-costs`, `/draft-document`; forms `/:id/draft`; oral `/respond`; discussions `/litConversations/:id/litMessages`; IRAC `/extract`, `/issues`, `/research`, `/application`, `/opinion`, `/analyze`, `/draft`, `/extract-template`, `/chat`.
- **MySyariahAI:** `/analyzer/analyze`, `/case-analysis/predict`, `/cause-papers/draft`, `/client-intake/generate-brief`, `/compliance-check/analyze`, `/document-generator/generate`, `/kitab/analyze`, `/legal-opinion/generate`, `/smart-search`, `/tafsir/generate`, `/voice-mode/respond`, `/voice-mode/feedback`, `/gemini/conversations/:conversationId/messages`.
- **MyCorpLegalAI:** `/legal/ai-tools/chat`, `/gemini/conversations/:id/messages`.
- **MyCorpCommBankLitAI:** `/tools/generate`, `/gemini/conversations/:id/messages`.

Non-AI conversation creation, authentication, TTS/transcription, upload, matter, billing, research-corpus, and persistence routes were excluded.

## Targeted verification

- `vitest` completion-contract tests: **8 passed**. Covered explicit terminal success and partial EOF failure for the MyLitAI shared helper, MySyariahAI shared consumer, MySyariahAI direct-reader response guard, and MyLitAI IRAC callback contract without invoking a provider.
- TypeScript checks: **passed** for MyCrimAI, MyLitAI, MyLitAI IRAC, and MySyariahAI.
- No live AI/provider calls and no broad test suites were run.

## Unverified areas

- Browser rendering/retry behavior was not exercised because this task did not start or restart applications.
- Browser rendering and user-driven retry remain unverified for the direct readers; validation here was isolated parser tests plus portal typechecks.
- MyLitAI IRAC enforcement uses the same corrected transport contract as its tested pipeline-stage reader, but the enforcement wrapper was not separately invoked in a test.
- MyCorpLegalAI already had a strict terminal completion contract in its shared hook; MyCorpCommBankLitAI and persisted discussion retry semantics were catalogued but not changed.
- MyAccidentAI, MyConveyLitAI, MyCorpCommBankLitAI, MyLawFirmAI, and MyLawAcad are assigned to the other worker and remain outside this report's verified frontend set.
- Persistence behavior and persistence tests are owned by the other worker and were not modified here.