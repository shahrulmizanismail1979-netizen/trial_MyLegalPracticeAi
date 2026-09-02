# Batch ETA + Pipeline Guide in Admin Documents

## What & Why
Two admin quality-of-life additions to the Documents page:

1. **ETA per PDF** — right now the batch modal shows a static status badge for each file. Admins uploading 15–50 PDFs have no sense of when a file will finish. Adding an estimated time remaining beside each item makes progress transparent.

2. **Pipeline guide** — the research database powers eight portals (MyLitAI, MyLitAI IRAC, MySyalitAI, MyCorpLegalAI, MyCrimAI, MyAccidentAI, MyCCBLitAI, MyConveyLitAI) but there is no explanation of how a PDF becomes searchable content. Admins need a short, always-visible guide showing the pipeline stages and which portals are fed by the corpus.

## Done looks like
- Each row in the Batch Items modal shows an estimated time beside files that are still processing (e.g. "~2 min", "queued ~4 min", "processing…")
- Finished or failed items show no ETA (not needed once complete)
- A new collapsible "Pipeline Guide" panel appears on the Documents admin page (above or below the batches table)
- The guide shows the pipeline stages in order: Upload → Ingest → Validation → Metadata Extraction → Segmentation → Rights Review → Editorial → Search Index
- Each stage has a one-line description of what happens
- A "Portals powered by this corpus" section lists all 8 portals with their names

## Out of scope
- Per-stage progress bars for individual containers (deep pipeline monitoring is a separate task)
- Real-time WebSocket push (polling every 3 s is already in place and sufficient)
- Editing or configuring the pipeline from this UI

## Steps
1. **Expose job timing in the batch detail API** — when `GET /api/research/uploads/:id` returns items, join `research_jobs` to include `startedAt`, `finishedAt`, and `state` for each item's ingest job (via the `jobId` foreign key on `research_upload_batch_items`). Also compute a `avgSecondsPerItem` across recently finished items in the same batch so the frontend can estimate queue wait.

2. **Add ETA calculation and display** — in `BatchDetailDialog`, use the returned timing fields to compute and show an ETA label beside each still-PENDING row: items with a running job show "processing…"; items with no started job show "queued (est. ~N min)" based on their position and the average; finished items show nothing. Keep the existing status badge unchanged.

3. **Add the Pipeline Guide panel** — add a new collapsible `PipelineGuide` component to the Documents admin page. It lists the 8 pipeline stages with a short description each, then lists all 8 portals that are fed by the research corpus. Style it consistently with the rest of the admin page (dark card, muted headings). Default to collapsed so it doesn't clutter the view.

## Relevant files
- `artifacts/landing-page/src/pages/admin/documents.tsx:201-351`
- `artifacts/api-server/src/research/routes/uploads.ts:103-117`
- `artifacts/api-server/src/research/data/uploads.ts:144-153`
- `lib/db/src/schema/research.ts:187-210`
