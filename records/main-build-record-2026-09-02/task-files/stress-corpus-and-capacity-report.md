# Synthetic Stress Corpus and Capacity Report

## What & Why
The research platform has no verified capacity envelope. Before adding more users or larger corpora we need to know: how many containers it can ingest reliably, where memory and storage blow up, which pipeline stages are safe inside the Replit web process, and which demand a separate worker. This task builds the measurement apparatus and produces a signed-off report.

The corpus is fully synthetic — no restricted or commercial material.

## Done looks like
- A repeatable corpus-generation script produces the full 500-container / several-thousand-case corpus on demand (no commercial source material anywhere in the tree)
- A test harness runs each of the 14 measurement dimensions against that corpus and records results
- The final report (`stress-report.md`) is committed and states all acceptance-gate values:
  - Tested corpus size
  - Safe batch size
  - Peak memory (RSS, heap)
  - Average and worst-case processing time per stage
  - Failure rate and retry outcomes
  - Search latency (p50 / p95 / p99)
  - Storage requirements (object storage + DB row growth)
  - Recommended deployment topology
  - Features that require external workers
  - Features safe for Replit hosting
- Resource-constraint boundaries are documented honestly — no silent fallback, no concealed OOM
- If bulk OCR or large-batch segmentation exceeds safe Replit limits, a queue-export / worker-handoff path is implemented that preserves the existing web app, the processing-adapter interface, and the source-and-result provenance model; the capacity boundary is documented in the report

## Out of scope
- Replacing the existing ingestion or segmentation pipeline (adapter interface is preserved)
- Actual OCR engine integration (synthetic PDFs simulate OCR-quality variation via controlled character corruption)
- Production load testing against a live deployment
- Any use of real court judgments or commercially licensed text

## Steps

### 1. Corpus generator
Write a standalone Node.js script (`scripts/generate-stress-corpus.ts`) that produces deterministic synthetic PDFs:
- **Native-text containers** — pdf-lib or pdfkit; 1–5 cases per file up to dense containers with 30 + cases; one or more editorial introduction sections mimicking publisher front-matter
- **Simulated-scanned containers** — embed synthetic raster text blocks (low-res image of monospace text) rather than selectable text; no actual OCR needed — the content is pre-rendered as an image plane
- **Duplicates** — identical byte content reused across two or more containers; also near-duplicate (same text, different whitespace) and hash-collision-safe copies
- **Incomplete cases** — judgment that ends mid-sentence (simulates truncated download)
- **Damaged files** — valid PDF envelope with corrupted xref table or null bytes inside stream; one variant that is not a PDF at all (renamed `.docx`)
- **Misleading boundaries** — section headings that look like case citations but are editorial sub-headings; footnote blocks that span across a logical page break
- **Cases split across files** — a single judgment that is spread across two consecutively-named containers, requiring cross-container stitching
- **Mixed OCR quality** — parameterised character-substitution function applied to extracted text (0 % error = perfect, 5 % = typical scan, 25 % = low-quality scan, 50 % = near-unreadable)
Target output: ~500 container files, ~3 000–4 000 synthetic case candidates in total, covering all corpus variant types above.

### 2. Upload reliability and queue stability
Wire the corpus through the real ingestion API (`POST /api/research/uploads`) inside an integration test using the existing `buildApp` + `runNextJob` pattern. Record per-file success/failure, HTTP status distribution, retry events, and final queue depth after full drain.

### 3. Memory and storage instrumentation
Sample `process.memoryUsage()` (RSS + heapUsed) before and after each pipeline stage (ingest, segment, analyse). Record `research_source_containers`, `research_transformations`, and `research_jobs` row counts after each batch. Record total bytes written to the storage adapter (sum of `put` calls). Plot growth curves at 50, 100, 250, and 500 containers.

### 4. Throughput and timing
Time each pipeline stage: upload validation, object-storage write, segmentation (per-container), AI analysis (per-judgment). Record min / average / p95 / max. Use the existing `Date.now()` instrumentation pattern; do not add external tracing dependencies.

### 5. Retry and job resumption
Deliberately inject transient failures (stub the storage adapter to throw once per three calls). Verify that `maxAttempts` retries succeed for recoverable errors, that the job is marked permanently failed after exhausting attempts, and that a restarted worker picks up in-flight jobs correctly after a simulated process crash (kill the event loop mid-job, restart, re-drain).

### 6. Concurrent users
Simulate 5 and 10 simultaneous uploaders via `Promise.all` batches. Record throughput degradation, lock contention (serialized DB errors), and any dropped jobs.

### 7. Search latency
After seeding the DB with 500 containers + cases, issue 50 representative search queries against the research search route. Record p50 / p95 / p99 latency. Note whether a DB index is missing (EXPLAIN ANALYZE on the slow queries).

### 8. Backup and restore
Snapshot the DB row counts and a sample of storage keys before the test run. After the run, verify that the existing DB backup/restore mechanism (pg_dump / psql round-trip in CI) produces a consistent restored state. Flag any tables that grow faster than the backup window can safely handle.

### 9. Architectural capacity analysis
After gathering the measurements, produce a frank assessment section in the report covering:
- **Safe inside Replit web process**: small-batch upload validation, metadata extraction, search, rights checks, export
- **Safe inside a Replit background worker** (polling `runNextJob` in the same dyno): segmentation of containers ≤ N cases (determine N from the memory curve), lightweight analysis jobs
- **Requires a separate worker service** (separate process, auto-scaling): bulk ingestion of > N containers at once, scanned-PDF OCR, AI analysis at volume
- **Requires external dedicated infrastructure**: corpus re-indexing, bulk re-segmentation, archival export pipelines
Document the exact memory and time thresholds that define each boundary. Do not round down — state the observed limits.

### 10. Queue export / worker handoff (if Replit limits are exceeded)
If steps 3–4 show that bulk processing blows past safe Replit memory limits (heuristic: RSS > 512 MB sustained or any OOM kill):
- Add a `POST /api/research/queue/export` endpoint that serialises the pending `research_jobs` queue to a signed JSON manifest (job type, container ID, retry count, enqueued_at)
- Add a corresponding `POST /api/research/queue/import` endpoint that re-hydrates that manifest into the `research_jobs` table (idempotent by job ID)
- The existing `StorageAdapter` and `AiProviderAdapter` interfaces remain unchanged — the worker handoff is a deployment-topology concern, not an API change
- Document the handoff protocol in `stress-report.md`

### 11. Write the acceptance-gate report
Commit `stress-report.md` at the repo root containing every required field from the acceptance gate. Include a short table mapping each architectural tier to the specific feature set it must host.

## Relevant files
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/ingestion/validation.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/segmentation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/segmentation/candidateComposer.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/storage/adapters.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `artifacts/api-server/src/research/analysis/processor.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/phase12d-security.test.ts`
