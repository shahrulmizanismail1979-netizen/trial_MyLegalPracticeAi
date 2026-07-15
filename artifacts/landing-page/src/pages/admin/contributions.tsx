import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout";
import {
  useListContributions,
  useUpdateContribution,
  useDeleteContribution,
  getListContributionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MoreVertical,
  CheckCircle,
  XCircle,
  Trash2,
  Download,
  FileText,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "Litigation",
  "Syariah",
  "Corporate Secretary",
  "Conveyancing",
  "Criminal",
  "Corporate/Commercial/Banking",
  "Accident & Personal Injury",
  "General/Other",
];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-500/10 text-green-500 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const EXTRACTION_LABELS: Record<string, string> = {
  extracted: "Text extracted",
  pending: "Extraction pending",
  unsupported: "Not text-extracted",
  failed: "Extraction failed",
};

const ANONYMIZATION_LABELS: Record<string, string> = {
  done: "Anonymised",
  pending: "Anonymising…",
  failed: "Anonymisation failed",
  skipped: "No text to anonymise",
};

const ANONYMIZATION_STYLES: Record<string, string> = {
  done: "bg-green-500/10 text-green-500 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  failed: "bg-red-500/10 text-red-500 border-red-500/20",
  skipped: "bg-secondary text-muted-foreground border-border",
};

type Contribution = {
  id: number;
  title: string;
  description?: string | null;
  categories: string[];
  contributorName: string;
  contributorEmail: string;
  contributorPhone?: string | null;
  fileName: string;
  objectPath: string;
  fileSize?: number | null;
  contentType?: string | null;
  extractedText?: string | null;
  extractionStatus: string;
  anonymizedText?: string | null;
  anonymizationStatus: string;
  status: string;
  adminNotes?: string | null;
  rewardVoucherCode?: string | null;
  createdAt: string | Date;
};

function objectDownloadUrl(objectPath: string): string {
  // objectPath is like "/objects/uploads/<id>"; served by the API at /api/storage/objects/...
  return `/api/storage${objectPath}`;
}

export default function ContributionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewing, setViewing] = useState<Contribution | null>(null);

  const queryClient = useQueryClient();

  const { data: contributions, isLoading } = useListContributions({
    search: search || undefined,
    status: statusFilter !== "all" ? (statusFilter as any) : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });

  const updateContribution = useUpdateContribution();
  const deleteContribution = useDeleteContribution();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListContributionsQueryKey() });

  const handleStatus = (id: number, status: "approved" | "rejected" | "pending") => {
    updateContribution.mutate(
      { id, data: { status } },
      {
        onSuccess: (updated) => {
          if (status === "approved" && updated?.rewardVoucherCode) {
            toast.success(
              `Adopted into knowledge base — reward voucher ${updated.rewardVoucherCode} (1 free month) issued. Share it with the contributor.`,
              { duration: 10000 },
            );
          } else {
            toast.success(
              status === "approved"
                ? "Adopted into knowledge base"
                : `Marked ${status}`,
            );
          }
          invalidate();
        },
        onError: () => toast.error("Failed to update status"),
      },
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this contribution permanently?")) {
      deleteContribution.mutate(
        { id },
        {
          onSuccess: () => {
            toast.success("Contribution deleted");
            invalidate();
          },
        },
      );
    }
  };

  return (
    <AdminLayout>
      <div className="flex flex-col space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">
            Contributions
          </h1>
          <p className="text-muted-foreground mt-1">
            Review submitted documents and adopt approved ones into the knowledge base.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-md border border-border">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, contributor or filename..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-4 w-full sm:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-border rounded-md bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Document</TableHead>
                <TableHead>Contributor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Extraction</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : contributions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No contributions found
                  </TableCell>
                </TableRow>
              ) : (
                contributions?.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <button
                        onClick={() => setViewing(c as Contribution)}
                        className="flex items-start gap-2 text-left hover:text-primary transition-colors"
                      >
                        <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{c.title}</div>
                          <div className="text-xs text-muted-foreground">{c.fileName}</div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{c.contributorName}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.contributorEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.categories.map((cat) => (
                          <Badge
                            key={cat}
                            variant="secondary"
                            className="text-[10px]"
                          >
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">
                          {EXTRACTION_LABELS[c.extractionStatus] ?? c.extractionStatus}
                        </span>
                        <Badge
                          variant="outline"
                          className={`w-fit text-[10px] ${ANONYMIZATION_STYLES[c.anonymizationStatus] ?? ""}`}
                        >
                          {ANONYMIZATION_LABELS[c.anonymizationStatus] ??
                            c.anonymizationStatus}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[c.status] ?? ""}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a
                              href={objectDownloadUrl(c.objectPath)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download className="mr-2 h-4 w-4" />
                              Download file
                            </a>
                          </DropdownMenuItem>
                          {c.status !== "approved" && (
                            <DropdownMenuItem onClick={() => handleStatus(c.id, "approved")}>
                              <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                              Adopt into knowledge base
                            </DropdownMenuItem>
                          )}
                          {c.status !== "rejected" && (
                            <DropdownMenuItem onClick={() => handleStatus(c.id, "rejected")}>
                              <XCircle className="mr-2 h-4 w-4 text-red-500" />
                              Reject
                            </DropdownMenuItem>
                          )}
                          {c.status !== "pending" && (
                            <DropdownMenuItem onClick={() => handleStatus(c.id, "pending")}>
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Reset to pending
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(c.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Contributor" value={viewing.contributorName} />
                <Info label="Email" value={viewing.contributorEmail} />
                <Info label="Phone" value={viewing.contributorPhone || "—"} />
                <Info label="Categories" value={viewing.categories.join(", ")} />
                <Info label="File" value={viewing.fileName} />
                <Info
                  label="Extraction"
                  value={
                    EXTRACTION_LABELS[viewing.extractionStatus] ??
                    viewing.extractionStatus
                  }
                />
                <Info
                  label="Anonymisation"
                  value={
                    ANONYMIZATION_LABELS[viewing.anonymizationStatus] ??
                    viewing.anonymizationStatus
                  }
                />
              </div>
              {viewing.rewardVoucherCode && (
                <div className="rounded-md border border-green-500/20 bg-green-500/10 p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Reward voucher (1 free month)
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-semibold">
                      {viewing.rewardVoucherCode}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(viewing.rewardVoucherCode!);
                        toast.success("Voucher code copied");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send this code to {viewing.contributorEmail} — it can be redeemed
                    once at checkout.
                  </p>
                </div>
              )}
              {viewing.description && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Notes
                  </div>
                  <p className="text-muted-foreground">{viewing.description}</p>
                </div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Anonymised text (what the public corpus will see)
                </div>
                {viewing.anonymizedText ? (
                  <pre className="whitespace-pre-wrap text-xs bg-secondary/50 border border-border rounded-md p-3 max-h-64 overflow-y-auto font-mono">
                    {viewing.anonymizedText}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {viewing.anonymizationStatus === "pending"
                      ? "Anonymisation is still running — refresh in a moment."
                      : "No anonymised text available for this document."}
                  </p>
                )}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Original extracted text (staff only — may contain real names)
                </div>
                {viewing.extractedText ? (
                  <pre className="whitespace-pre-wrap text-xs bg-secondary/50 border border-border rounded-md p-3 max-h-64 overflow-y-auto font-mono">
                    {viewing.extractedText}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    No extracted text available for this document.
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <a
                  href={objectDownloadUrl(viewing.objectPath)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <Download className="mr-2 h-4 w-4" /> Download original
                  </Button>
                </a>
                {viewing.status !== "approved" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      handleStatus(viewing.id, "approved");
                      setViewing(null);
                    }}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" /> Adopt
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 break-words">{value}</div>
    </div>
  );
}
