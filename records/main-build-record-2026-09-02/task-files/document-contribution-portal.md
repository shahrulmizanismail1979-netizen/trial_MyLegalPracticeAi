# Document Contribution Portal

## What & Why
Let legal professionals contribute soft-copy cause papers and legal documents to strengthen the whole AI Portals ecosystem. Contributions are stored at scale, organized by category, and turned into a curated, searchable knowledge base that the apps can draw on to improve their proficiency and familiarity with real Malaysian legal documents.

Important architectural reality: the 7 apps are separate external deployments. This task builds the full supply side on THIS project — collection, large-volume storage, categorization, text extraction, curation, and a read API that exposes the approved corpus. Actually wiring each external app to consume the corpus (RAG/fine-tuning inside those apps) is out of scope here because it must be done inside each app.

## Done looks like
- Anyone can open a "Contribute" page from the landing page, fill in their name/email, pick one or more categories, and upload documents of ANY file format (PDF, DOC/DOCX, images, scans, ZIP, etc.).
- Multiple large files can be uploaded in one go without hitting a small size cap; storage scales to large volumes (object storage, not the DB).
- Each upload is recorded with contributor info, chosen category, original filename, size, format, and a status.
- Uploaded documents show a clear on-screen confirmation and a note that contributions are reviewed before being adopted into the knowledge base.
- Admin dashboard gets a "Contributions" section listing every submission, filterable by category and status, with the ability to download the original file and to change status (Pending -> Approved/Adopted -> Rejected).
- When a document is marked Adopted, its extracted text becomes part of a searchable knowledge base, and a read-only API endpoint can return approved/adopted corpus entries (title, category, extracted text, source metadata) so any app can consume it later.
- Text is auto-extracted where the format allows (PDF, DOCX, plain text); formats that can't be parsed are still stored and downloadable, just flagged as "not text-extracted".

## Out of scope
- Modifying the external apps (mylitai.life, mysyalitai.life, mycorpai.life, myconveyai.life, mycrimai.life, myccblitai.life, myaccidentai.life) to actually query/train on the corpus. That is separate work inside each app.
- Automatic model fine-tuning / retraining. We build the curated corpus + API; consumption is the apps' responsibility.
- Authentication/accounts for contributors (open submission with name/email, consistent with the existing open admin). Can be added later.
- OCR of scanned image-only PDFs (store + flag; OCR can be a later enhancement).

## Steps
1. **Provision object storage** — Set up App Storage (GCS-backed) for large-volume, any-format file storage, and wire the presigned-URL upload endpoints and object-serving routes into the API server.
2. **Contributions data model** — Add a `contributions` table capturing contributor name/email, category, original filename, content type, size, object storage path, extracted-text field, extraction status, and review status; regenerate the API layer from the OpenAPI spec.
3. **Contribution API** — Add endpoints to create a contribution record (after upload), list/filter contributions (admin), update status, and a read-only "knowledge base" endpoint returning approved/adopted entries with extracted text for downstream app consumption.
4. **Server-side text extraction** — On contribution create (or on adopt), extract text from supported formats (PDF, DOCX, TXT) into the extracted-text field; mark unsupported formats as not-extracted but keep them stored/downloadable.
5. **Public Contribute page** — Add a branded "Contribute" page/section to the landing page: contributor details, category picker (aligned to the app domains: Litigation, Syariah, Corporate Secretary, Conveyancing, Criminal, Corp/Comm/Banking, Accident & PI, plus a General/Other), multi-file any-format uploader with progress, and a clear confirmation + review-notice message. Add a nav/CTA entry point to it.
6. **Admin Contributions view** — Add a "Contributions" page to the admin dashboard to browse/filter by category and status, download original files, and change review status (including "Adopt into knowledge base").

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/admin/index.ts`
- `artifacts/api-server/src/routes/admin/subscribers.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/schema/subscribers.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-spec/orval.config.ts`
- `artifacts/landing-page/src/pages/home.tsx`
- `artifacts/landing-page/src/pages/admin/subscribers.tsx`
- `artifacts/landing-page/src/components/admin/layout.tsx`
- `artifacts/landing-page/src/components/apps-grid.tsx`
