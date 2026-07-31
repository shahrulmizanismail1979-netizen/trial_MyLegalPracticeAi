import { useState, useRef, useCallback } from "react";
import { AdminLayout } from "@/components/admin/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  XCircle,
  RotateCcw,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  FolderOpen,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BatchItemState =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "INGESTED"
  | "DUPLICATE"
  | "REJECTED"
  | "DONE"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED";

type BatchState = "ACTIVE" | "CANCELLED" | "COMPLETED" | "PARTIAL";

interface BatchItem {
  id: number;
  originalPath: string;
  state: BatchItemState;
  errorReport?: string | null;
  // Job timing (present when a job row exists for this item)
  jobState?: string | null;
  jobStartedAt?: string | null;
  jobFinishedAt?: string | null;
  /** Processing state of the linked research container (null until ingest completes) */
  containerState?: string | null;
}

interface Progress {
  total: number;
  done: number;
  failed: number;
  pending: number;
  processing: number;
}

interface Batch {
  id: number;
  declaredSource: string;
  uploadedBy?: string | null;
  state: BatchState;
  createdAt: string;
  updatedAt: string;
}

interface BatchDetail extends Batch {
  progress: Progress;
  items: BatchItem[];
  /** Average ingest duration (seconds) across already-finished items, or null */
  avgSecondsPerItem?: number | null;
}

// ---------------------------------------------------------------------------
// ETA helpers
// ---------------------------------------------------------------------------

const FALLBACK_SECS_PER_ITEM = 45; // used when no finished items yet

function fmtEta(seconds: number): string {
  if (seconds < 90) return `~${Math.round(seconds)}s`;
  return `~${Math.round(seconds / 60)} min`;
}

/** Returns a short ETA label for items that are still waiting/processing. */
function itemEtaLabel(
  item: BatchItem,
  queueIndex: number, // position among still-pending items (0-based)
  avgSecs: number,
): string | null {
  const terminal = new Set<BatchItemState>([
    "INGESTED",
    "DUPLICATE",
    "REJECTED",
    "DONE",
    "DEAD_LETTER",
    "FAILED",
    "CANCELLED",
  ]);
  if (terminal.has(item.state)) return null;

  if (
    item.jobState === "RUNNING" ||
    item.state === "PROCESSING"
  ) {
    return "processing…";
  }

  // Item is queued — estimate based on queue position
  const waitSecs = avgSecs * (queueIndex + 1);
  return `queued · est. ${fmtEta(waitSecs)}`;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function listBatches(): Promise<Batch[]> {
  return apiFetch<Batch[]>("/api/research/uploads");
}

async function getBatch(id: number): Promise<BatchDetail> {
  return apiFetch<BatchDetail>(`/api/research/uploads/${id}`);
}

async function uploadBatch(
  files: File[],
  declaredSource: string,
): Promise<BatchDetail> {
  const form = new FormData();
  form.append("declaredSource", declaredSource);
  for (const f of files) form.append("files", f);
  return apiFetch<BatchDetail>("/api/research/uploads", {
    method: "POST",
    body: form,
  });
}

async function retryItem(batchId: number, itemId: number): Promise<void> {
  await apiFetch(`/api/research/uploads/${batchId}/items/${itemId}/retry`, {
    method: "POST",
  });
}

async function cancelBatch(batchId: number): Promise<void> {
  await apiFetch(`/api/research/uploads/${batchId}/cancel`, {
    method: "POST",
  });
}

async function approveRights(
  batchId: number,
): Promise<{ approved: number; skipped: number }> {
  return apiFetch(`/api/research/uploads/${batchId}/approve-rights`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

const BATCH_ITEM_STATE_STYLES: Record<BatchItemState, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  QUEUED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PROCESSING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  INGESTED: "bg-green-500/10 text-green-400 border-green-500/20",
  DUPLICATE: "bg-secondary text-muted-foreground border-border",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  DONE: "bg-green-500/10 text-green-400 border-green-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
  DEAD_LETTER: "bg-red-500/10 text-red-400 border-red-500/20",
  CANCELLED: "bg-secondary text-muted-foreground border-border",
};

const BATCH_STATE_STYLES: Record<BatchState, string> = {
  ACTIVE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPLETED: "bg-green-500/10 text-green-400 border-green-500/20",
  PARTIAL: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  CANCELLED: "bg-secondary text-muted-foreground border-border",
};

function BatchItemStateIcon({ state }: { state: BatchItemState }) {
  switch (state) {
    case "DONE":
    case "INGESTED":
      return <CheckCircle size={14} className="text-green-400" />;
    case "PROCESSING":
    case "QUEUED":
      return <Loader2 size={14} className="text-blue-400 animate-spin" />;
    case "DEAD_LETTER":
    case "FAILED":
    case "REJECTED":
      return <AlertCircle size={14} className="text-red-400" />;
    case "CANCELLED":
    case "DUPLICATE":
      return <XCircle size={14} className="text-muted-foreground" />;
    default:
      return <Clock size={14} className="text-yellow-400" />;
  }
}

function ProgressBar({ progress }: { progress: Progress }) {
  const donePct =
    progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
  const failedPct =
    progress.total > 0 ? (progress.failed / progress.total) * 100 : 0;
  return (
    <div className="w-full">
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
        <div
          className="bg-green-500 transition-all"
          style={{ width: `${donePct}%` }}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${failedPct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {progress.done}/{progress.total} done
        {progress.failed > 0 && (
          <span className="text-red-400 ml-1">· {progress.failed} failed</span>
        )}
        {progress.processing > 0 && (
          <span className="text-blue-400 ml-1">
            · {progress.processing} processing
          </span>
        )}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch detail dialog
// ---------------------------------------------------------------------------

function BatchDetailDialog({
  batchId,
  open,
  onClose,
}: {
  batchId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["research-batch", batchId],
    queryFn: () => getBatch(batchId!),
    enabled: open && batchId != null,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      // Poll while ingest jobs are active OR while containers are moving
      // through the research pipeline (anything that isn't terminal).
      const TERMINAL_CONTAINER_STATES = new Set([
        "SEARCHABLE", "DELETED", "DUPLICATE", "REJECTED",
      ]);
      const active = d.items.some(
        (i) =>
          i.state === "PENDING" || i.state === "QUEUED" || i.state === "PROCESSING" ||
          (i.containerState != null && !TERMINAL_CONTAINER_STATES.has(i.containerState)),
      );
      return active ? 4000 : false;
    },
  });

  const retryMut = useMutation({
    mutationFn: ({ itemId }: { itemId: number }) =>
      retryItem(batchId!, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["research-batches"] });
      toast.success("Item queued for retry");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelBatch(batchId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["research-batches"] });
      toast.success("Batch cancelled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveRightsMut = useMutation({
    mutationFn: () => approveRights(batchId!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["research-batch", batchId] });
      queryClient.invalidateQueries({ queryKey: ["research-batches"] });
      if (result.approved > 0) {
        toast.success(
          `Rights approved for ${result.approved} document${result.approved !== 1 ? "s" : ""} — pipeline started`,
        );
      } else {
        toast.info("All documents already past rights review");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            Batch #{batchId} — Items
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 size={18} className="animate-spin" />
            Loading…
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-card border border-border rounded-md p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  Source
                </p>
                <p className="font-medium text-foreground">{data.declaredSource}</p>
              </div>
              <div className="bg-card border border-border rounded-md p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">
                  Uploaded by
                </p>
                <p className="font-medium text-foreground truncate">
                  {data.uploadedBy ?? "—"}
                </p>
              </div>
            </div>

            <ProgressBar progress={data.progress} />

            {(() => {
              const awaitingRights = data.items.filter(
                (i) => i.containerState === "RIGHTS_REVIEW_REQUIRED",
              );
              const PIPELINE_ACTIVE_STATES = new Set([
                "RIGHTS_APPROVED", "INVENTORY_PENDING", "INVENTORIED",
                "EXTRACTION_PENDING", "OCR_REVIEW_REQUIRED", "TEXT_EXTRACTED",
                "SEGMENTATION_PENDING", "SEGMENTATION_PROPOSED",
                "SEGMENTATION_REVIEW_REQUIRED", "EDITORIAL_REVIEW_PENDING",
                "EDITORIAL_REVIEW_REQUIRED", "JUDGMENT_VERIFICATION_PENDING",
              ]);
              const pipelineActive = data.items.filter(
                (i) => i.containerState != null && PIPELINE_ACTIVE_STATES.has(i.containerState),
              );
              const pipelineDone = data.items.filter(
                (i) => i.containerState === "SEARCHABLE",
              );

              if (awaitingRights.length > 0) {
                return (
                  <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2.5">
                    <div className="text-sm">
                      <span className="font-medium text-amber-300">
                        {awaitingRights.length} document{awaitingRights.length !== 1 ? "s" : ""} awaiting rights approval
                      </span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        — approve to start extraction & indexing pipeline
                      </span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => approveRightsMut.mutate()}
                      disabled={approveRightsMut.isPending}
                      className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white border-0"
                    >
                      {approveRightsMut.isPending ? (
                        <>
                          <Loader2 size={13} className="mr-1.5 animate-spin" />
                          Approving…
                        </>
                      ) : (
                        <>
                          <CheckCircle size={13} className="mr-1.5" />
                          Approve Rights & Start Pipeline
                        </>
                      )}
                    </Button>
                  </div>
                );
              }
              if (pipelineActive.length > 0) {
                return (
                  <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-md px-3 py-2.5 text-sm">
                    <Loader2 size={14} className="animate-spin text-blue-400 shrink-0" />
                    <span className="text-blue-300 font-medium">
                      Pipeline running —
                    </span>
                    <span className="text-muted-foreground">
                      {pipelineActive.length} document{pipelineActive.length !== 1 ? "s" : ""} processing
                      {pipelineDone.length > 0 && `, ${pipelineDone.length} indexed`}
                    </span>
                  </div>
                );
              }
              if (pipelineDone.length > 0 && pipelineDone.length === data.items.filter(i => i.containerState != null).length) {
                return (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-md px-3 py-2.5 text-sm">
                    <CheckCircle size={14} className="text-green-400 shrink-0" />
                    <span className="text-green-300 font-medium">All documents indexed and searchable</span>
                  </div>
                );
              }
              return null;
            })()}

            {data.state === "ACTIVE" && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelMut.mutate()}
                  disabled={cancelMut.isPending}
                  className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                >
                  <XCircle size={14} className="mr-1.5" />
                  Cancel batch
                </Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px] text-right pr-4">ETA</TableHead>
                  <TableHead className="w-[48px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const avg = data.avgSecondsPerItem ?? FALLBACK_SECS_PER_ITEM;
                  let queueIdx = 0;
                  return data.items.map((item) => {
                    const isPending = item.state === "PENDING" || item.state === "QUEUED";
                    const eta = itemEtaLabel(item, queueIdx, avg);
                    if (isPending) queueIdx += 1;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs max-w-[300px] truncate">
                          {item.originalPath.split("/").pop()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <BatchItemStateIcon state={item.state} />
                            <Badge
                              variant="outline"
                              className={`text-xs ${BATCH_ITEM_STATE_STYLES[item.state] ?? "bg-secondary text-muted-foreground border-border"}`}
                            >
                              {item.state}
                            </Badge>
                            {item.containerState && item.state === "INGESTED" && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  item.containerState === "SEARCHABLE"
                                    ? "bg-green-500/10 text-green-400 border-green-500/30"
                                    : item.containerState === "RIGHTS_REVIEW_REQUIRED"
                                      ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                      : item.containerState.includes("PENDING") || item.containerState.includes("REVIEW")
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                        : "bg-secondary text-muted-foreground border-border"
                                }`}
                              >
                                {item.containerState.replace(/_/g, " ")}
                              </Badge>
                            )}
                          </div>
                          {item.errorReport && (
                            <p className="text-xs text-red-400 mt-1 max-w-xs truncate" title={item.errorReport}>
                              {item.errorReport}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          {eta && (
                            <span className="text-xs text-muted-foreground">
                              {eta}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {(item.state === "DEAD_LETTER" || item.state === "FAILED") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryMut.mutate({ itemId: item.id })}
                              disabled={retryMut.isPending}
                              title="Retry"
                            >
                              <RotateCcw size={14} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Guide
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  {
    step: "1",
    name: "Upload",
    desc: "PDF files are uploaded in a batch and staged in object storage.",
  },
  {
    step: "2",
    name: "Ingest",
    desc: "Each file is validated (PDF, size, duplicate check) and queued for extraction.",
  },
  {
    step: "3",
    name: "Validation",
    desc: "Structural integrity check — ensures the document is parseable and non-empty.",
  },
  {
    step: "4",
    name: "Metadata Extraction",
    desc: "AI extracts case name, citation, court, date, parties, and legal domain.",
  },
  {
    step: "5",
    name: "Segmentation",
    desc: "Judgment text is split into logical sections (facts, issues, reasoning, holding).",
  },
  {
    step: "6",
    name: "Rights Review",
    desc: "An admin confirms reproduction rights are cleared before the document goes live.",
  },
  {
    step: "7",
    name: "Editorial",
    desc: "Optional quality pass — editorial annotations, flags, or enrichment are applied.",
  },
  {
    step: "8",
    name: "Search Index",
    desc: "Approved text and metadata are written to the vector and full-text search indexes.",
  },
];

const POWERED_PORTALS = [
  { name: "MyLitAI", slug: "mylitai" },
  { name: "MyLitAI IRAC", slug: "mylitai-irac" },
  { name: "MySyalitAI", slug: "mysyariahai" },
  { name: "MyCorpLegalAI", slug: "mycorplegalai" },
  { name: "MyCrimAI", slug: "mycrimai" },
  { name: "MyAccidentAI", slug: "myaccidentai" },
  { name: "MyCCBLitAI", slug: "myccblitai" },
  { name: "MyConveyLitAI", slug: "myconveylitai" },
];

function PipelineGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            How the research pipeline works
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            — from uploaded PDF to searchable judgment
          </span>
        </div>
        {open ? (
          <ChevronDown size={15} className="text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight size={15} className="text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5 border-t border-border pt-4">
          {/* Stage list */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              Pipeline stages
            </p>
            <ol className="space-y-2">
              {PIPELINE_STAGES.map((s) => (
                <li key={s.step} className="flex gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {s.step}
                  </span>
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {s.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {s.desc}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Portals */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">
              Portals powered by this corpus
            </p>
            <div className="flex flex-wrap gap-2">
              {POWERED_PORTALS.map((p) => (
                <span
                  key={p.slug}
                  className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded-full px-3 py-1 text-xs text-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload dialog
// ---------------------------------------------------------------------------

function UploadDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [source, setSource] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMut = useMutation({
    mutationFn: () => uploadBatch(files, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-batches"] });
      toast.success(`Uploaded ${files.length} file${files.length !== 1 ? "s" : ""} — processing started`);
      setFiles([]);
      setSource("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const pdfs = Array.from(incoming).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (pdfs.length !== incoming.length) {
      toast.warning("Only PDF files are accepted — others were skipped");
    }
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...pdfs.filter((f) => !existing.has(f.name + f.size))];
    });
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [],
  );

  const canSubmit = files.length > 0 && source.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Upload Documents</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Source field */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Source <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="e.g. MLJ Vol 3 2024, CLJ Online, KHN submission…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Where these judgments came from — used for provenance tracking.
            </p>
          </div>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-foreground font-medium">
              Drop PDF files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Up to 25 files per batch
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="bg-card border border-border rounded-md divide-y divide-border max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <div
                  key={`${f.name}-${f.size}`}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <FileText size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{f.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((_, j) => j !== i));
                    }}
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={uploadMut.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => uploadMut.mutate()}
              disabled={!canSubmit || uploadMut.isPending}
            >
              {uploadMut.isPending ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} className="mr-2" />
                  Upload {files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""}` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DocumentsPage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: batches, isLoading } = useQuery({
    queryKey: ["research-batches"],
    queryFn: listBatches,
    refetchInterval: 10000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["research-batches"] });

  const totalDocs = batches?.reduce((acc, b) => acc, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">
              Documents
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload judgment PDFs and track ingestion progress.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={14} className="mr-1.5" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload size={14} className="mr-1.5" />
              Upload PDFs
            </Button>
          </div>
        </div>

        {/* Stats row */}
        {batches && batches.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                {
                  label: "Total batches",
                  value: batches.length,
                  icon: FolderOpen,
                  color: undefined as string | undefined,
                },
                {
                  label: "Completed",
                  value: batches.filter((b) => b.state === "COMPLETED").length,
                  icon: CheckCircle,
                  color: "text-green-400" as string | undefined,
                },
                {
                  label: "Active",
                  value: batches.filter((b) => b.state === "ACTIVE").length,
                  icon: Loader2,
                  color: "text-blue-400" as string | undefined,
                },
                {
                  label: "Partial / failed",
                  value: batches.filter((b) => b.state === "PARTIAL").length,
                  icon: AlertCircle,
                  color: "text-yellow-400" as string | undefined,
                },
              ]
            ).map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-md p-4"
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Icon size={14} className={color} />
                  <span className="text-xs uppercase tracking-wide">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color ?? "text-foreground"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline guide */}
        <PipelineGuide />

        {/* Batch list */}
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground p-10 justify-center">
              <Loader2 size={18} className="animate-spin" />
              Loading batches…
            </div>
          ) : !batches || batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-16 text-center">
              <FolderOpen size={40} className="text-muted-foreground/40" />
              <p className="text-muted-foreground">No documents uploaded yet.</p>
              <Button onClick={() => setUploadOpen(true)}>
                <Upload size={14} className="mr-2" />
                Upload your first batch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Uploaded by</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[32px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow
                    key={batch.id}
                    className="cursor-pointer hover:bg-secondary/50"
                    onClick={() => setSelectedBatch(batch.id)}
                  >
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      #{batch.id}
                    </TableCell>
                    <TableCell className="font-medium max-w-[220px] truncate">
                      {batch.declaredSource}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[180px]">
                      {batch.uploadedBy ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${BATCH_STATE_STYLES[batch.state]}`}
                      >
                        {batch.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(batch.createdAt).toLocaleDateString("en-MY", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <ChevronRight
                        size={16}
                        className="text-muted-foreground"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <BatchDetailDialog
        batchId={selectedBatch}
        open={selectedBatch != null}
        onClose={() => setSelectedBatch(null)}
      />
    </AdminLayout>
  );
}
