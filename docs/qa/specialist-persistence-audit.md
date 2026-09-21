# Specialist AI persistence, reopen, export, and isolation audit

Audit date: 2026-09-21

## Safety and method

This audit used the checked-in Express route registrations and focused test inventory. It did not call an AI provider, send email, use payments, enqueue research work, touch research tasks 595/596, or alter research files/schema. The one new live-DB proof uses two run-unique CCB access codes and exact ID-scoped cleanup; it inserts the assistant message directly rather than invoking Gemini.

“Verified” below means an automated route-level assertion exists and was inspected, or the new focused proof was run. “Implemented, unverified” means the route exists but this audit did not execute an end-to-end persistence proof. UI/browser behavior is not claimed.

## Route and coverage inventory

| Feature | Actual persistence/reopen routes | Export route | Audit result |
|---|---|---|---|
| MyLitAI | `GET/POST /api/lit/saved-work`, `GET/PATCH/DELETE /api/lit/saved-work/:id`; matter filing under `/api/lit/matters/:id/work`; IRAC generation under `/api/lit/irac/*` | `POST /api/lit/exports/docx` | Ownership predicates are present in saved-work CRUD and matter linking. Existing tests cover LAWYes retry-safe save/reload and matter permissions, but there is no focused legacy saved-work save/reopen/export/foreign-mutation suite. Export accepts caller-supplied content and does not itself load a tenant row. |
| MyLitAI IRAC | Generated stages at `/api/lit/irac/issues`, `/research`, `/application`, `/opinion`, `/analyze`, `/draft`; persistence is through Lit saved work/matters | Lit DOCX export above | Matter context prompt tests exist. No isolated test proves an IRAC result is saved, reopened, and exported as the same content. |
| MyCorpLegalAI | `GET/POST /api/corp/saved-work`, `GET/PATCH/DELETE /api/corp/saved-work/:id`, `/api/corp/matters/:id/work`; chat history at `/api/corp/gemini/conversations*` | No specialist-output export route found | Shared matter-file implementation owner-scopes reads, links, updates, and deletes. Corp AI matter-context tests exist. No focused Gemini history isolation test or saved-output reopen/export proof was found. |
| MyCorpCommBankLitAI | `/api/ccb/gemini/conversations*`; `GET/POST /api/ccb/saved-work`, item CRUD and `/api/ccb/matters/:id/work` | No specialist-output export route found | New focused CCB proof verifies create/reopen, foreign read/list/delete denial, and successful owner deletion with FK-cascaded output removal. Existing matter tests verify static-code matter isolation and filing. |
| MyConveyLitAI | `GET/POST /api/convey/saved-work`, item CRUD and `/api/convey/matters/:id/work` | `POST /api/convey/export-docx` | Shared matter-file ownership checks are present; billing tests do not prove specialist output persistence. No focused save/reopen/export/foreign-mutation test was found. Export uses request content rather than reopening a saved row. |
| MyCrimAI | `GET/POST /api/crim/saved-work`, `GET/PATCH/DELETE /api/crim/saved-work/:id`; `/api/crim/matters/:id/work` | No specialist-output export route found | Saved-work code scopes every CRUD operation and matter link by resolved access-code tenant. Existing criminal matter tests cover matter isolation, but no focused AI-output save/reopen/export proof was found. |
| MyAccidentAI | `GET/POST /api/accident/saved-work`, item CRUD; `/api/accident/matters/:id/work` | No specialist-output export route found | Existing matter integration test verifies filing and foreign matter/attach denial. Standalone saved-work reopen, patch/delete denial, and export are not covered. |
| MySyariahAI | `/api/sya/matters/:id/work` (GET/POST/DELETE) | No specialist-output export route found | Existing matter integration tests cover filing and owner isolation. No standalone history/item reopen route exists; the matter work list is the reopen surface. No specialist export proof exists. |
| MyLawFirmAI | Durable goals, tasks/attempts, meeting minutes and task creation under `/api/firm/*`; meeting reopen at `GET /api/firm/meetings/:id` | `POST /api/firm/meetings/:id/export-docx`; Google export also exists but was not invoked | Workspace-auth and storage isolation tests exist. This audit did not run meeting AI-output persistence/export; Google export is explicitly untested because it is an external side effect. |
| MyLawAcad | Exam/studio attempts and summaries under `/api/acad/exams/:id/summary` and `/api/acad/studio/attempts/:id/summary` | No specialist-output export route found | Attempts/answers/summaries are durable route surfaces. No focused tenant-isolation and export proof for AI-generated academic output was found. Candidate attempt-token access is a different boundary from firm tenancy and remains unverified here. |

## Corrected implementation defect

The audit originally confirmed that `DELETE /api/ccb/gemini/conversations/:id` deleted all messages by the requested conversation ID before deleting the conversation with its tenant predicate. A subscriber could therefore submit another tenant’s conversation ID, receive `404`, yet erase that conversation’s persisted messages.

The handler now performs one owner-scoped parent `DELETE` and relies on the existing `ccb_messages.conversation_id ON DELETE CASCADE`. The parent and child deletion are one atomic database operation. Missing and foreign IDs remain indistinguishable `404` responses with no child-row side effect, while an owner deletion retains the existing `200 { success: true }` response and removes its messages.

## Adjacent Lit conversation DELETE review

Read-only inspection found no identical foreign-ID deletion path in `DELETE /api/lit/gemini/litConversations/:id`: it calls `accessibleConversation(..., "editor")` before deleting messages, and that helper scopes the lookup by `access_code_id` plus LAWYes matter role where applicable.

It does have a weaker adjacent atomicity/TOCTOU pattern: after the authorization read it deletes messages and then deletes the conversation in two separate, unscoped statements. A database failure between those statements could leave an owned conversation with its output erased, and the mutation is not bound to the ownership predicate used by the check. No Lit implementation was changed in this task. A future coordinated fix should issue one owner/grant-scoped parent deletion and rely on its message FK cascade (or use a transaction with the authorization predicate retained).

## Important gaps and non-claims

1. No browser verification was performed. Save panels, reopen navigation, downloaded filenames, and rendered document fidelity remain untested.
2. Specialist-output export is absent for CCB, Corp, Crim, Accident, Syariah, and Acad in the inspected route inventory. “Save” must not be presented as “export.”
3. Lit and Convey DOCX endpoints export posted content; current tests do not prove that exported bytes correspond to a persisted, owner-scoped record reopened from the server.
4. Shared matter-file routes provide the strongest common owner-scoped implementation for Corp, CCB, and Convey, but each portal still needs an authenticated route proof because tenant resolution differs.
5. Firm Google Docs export, all live AI generation, voice/transcription providers, research queues, emails, and payments were intentionally not exercised.

## New focused test

`artifacts/api-server/src/ccb/routes/gemini-persistence-isolation.audit.test.ts`

Coverage:

- subscriber A creates a durable conversation;
- a persisted assistant output is reopened by A;
- subscriber B cannot list, fetch, or fetch messages for A’s conversation;
- subscriber B’s DELETE returns 404 and must not destroy A’s output;
- subscriber A’s DELETE succeeds and atomically cascades the conversation messages;
- cleanup deletes only captured conversation/message IDs and the two run-unique access-code IDs.

The focused suite passes after the CCB correction.