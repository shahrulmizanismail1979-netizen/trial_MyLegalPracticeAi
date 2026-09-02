# AI Headnotes & Catchwords Generator

## What & Why
The research pipeline produces verified judgments and extracted metadata (case name, citation, court, parties, dates) but has no headnotes or catchwords — the two most important law reporter outputs. This task adds: a DB schema for structured headnotes and catchwords, an AI processor (Gemini) that generates professional law reporter-style headnotes and catchwords from verified judgment text, and a review/approval workflow so editors can confirm or edit AI-generated output before it goes live.

## Done looks like
- Each verified judgment in `research_verified_judgments` can have one or more headnotes (numbered, summarising each point of law) and a list of catchwords (keyword phrases, hierarchical e.g. "Contract — Breach — Damages")
- Headnotes follow Malaysian law reporter style: numbered paragraphs, each stating a point of law held, with the paragraph reference from the judgment
- Catchwords are comma/em-dash separated keyword hierarchies matching MLJ/CLJ conventions
- AI-generated headnotes and catchwords are marked `ai_draft` until reviewed; a Research Admin review UI lets editors accept, edit, or regenerate them
- Accepted headnotes and catchwords are included in the search index

## Out of scope
- Headnote display in portal apps (covered in the portal API + UI tasks)
- Ratio decidendi or full law report writing (future)

## Steps
1. **Schema** — Add `research_headnotes` table (judgment_id, number, text, point_of_law_paragraph_ref, status: ai_draft/accepted/rejected, processor_version, created_at) and `research_catchwords` table (judgment_id, catchword_line, status, processor_version, created_at). Add indexes and export types.
2. **AI processor** — Register a `container.headnotes` job processor that: fetches the verified judgment's full text (paragraphs from `research_verified_judgments`), calls Gemini with a Malaysian law reporter prompt requesting structured headnotes (JSON array of {number, text, paragraphRef}) and catchwords (string in MLJ format), validates the JSON, and upserts rows into both tables with status `ai_draft`.
3. **Auto-enqueue** — After a judgment's search-index job succeeds, automatically enqueue a `container.headnotes` job for that judgment (idempotent: skip if headnotes already accepted).
4. **Review API** — Add endpoints under `/api/research-admin/headnotes/:judgmentId` to list ai_draft headnotes/catchwords, `PATCH` to edit text and mark `accepted`, `DELETE` to reject, and `POST /regenerate` to re-run the AI processor.
5. **Admin review UI** — Add a "Headnotes Review" page in the Research Admin console listing judgments with `ai_draft` headnotes, with inline editing, accept/reject buttons, and a regenerate option.

## Relevant files
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/analysis/processor.ts`
- `artifacts/api-server/src/routes/research-admin.ts`
- `artifacts/research-admin/src/pages/`
- `artifacts/api-server/src/research/search/searchIndexProcessor.ts`
