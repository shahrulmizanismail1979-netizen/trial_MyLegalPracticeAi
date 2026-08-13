import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { MatterFileUpload, type ExtractedFile } from "@/components/MatterFileUpload";
import WorkspaceLayout from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { isAuthenticated } from "@/lib/auth";
import {
  useMatters,
  useCreateMatter,
  generateFileRef,
  fmtDate,
  ApiError,
} from "@/hooks/use-matters";
import { FolderKanban, FolderPlus, Lock, ArrowRight, User, Hash } from "lucide-react";

function statusColor(status: string) {
  switch (status) {
    case "open":
      return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
    case "closed":
      return "text-muted-foreground border-border bg-muted";
    default:
      return "text-amber-500 border-amber-500/30 bg-amber-500/10";
  }
}

export default function MattersPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: matters, isLoading, error } = useMatters();
  const createMatter = useCreateMatter();

  const [open, setOpen] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [form, setForm] = useState({ title: "", clientName: "", counterparty: "", matterType: "", notes: "" });

  useEffect(() => {
    if (!isAuthenticated()) setLocation("/access");
  }, [setLocation]);

  const isForbidden = error instanceof ApiError && error.status === 403;

  const submitCreate = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    try {
      const fileContext = extractedFiles.filter(f => f.text?.trim()).map(f => '=== ' + f.name + ' ===\n' + f.text.trim()).join('\n\n');
      const notes = fileContext
        ? (form.notes?.trim() ? form.notes.trim() + '\n\n--- Supporting Documents ---\n' + fileContext : '--- Supporting Documents ---\n' + fileContext)
        : (form.notes || null);
      const matter = await createMatter.mutateAsync({
        title: form.title.trim(),
        clientName: form.clientName || null,
        counterparty: form.counterparty || null,
        matterType: form.matterType || null,
        reference: generateFileRef("CCB"),
        status: "open",
        notes: notes || null,
      });
      toast({ title: "Matter created" });
      setOpen(false);
      setExtractedFiles([]);
      setForm({ title: "", clientName: "", counterparty: "", matterType: "", notes: "" });
      setLocation(`/workspace/matters/${matter.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast({ title: "Subscriber access required", description: e.message, variant: "destructive" });
      } else {
        toast({ title: "Could not create matter", description: e instanceof Error ? e.message : "", variant: "destructive" });
      }
    }
  };

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground mb-2 flex items-center gap-2">
              <FolderKanban className="h-7 w-7 text-primary" /> Matter Files
            </h1>
            <p className="text-muted-foreground text-lg max-w-3xl">
              Organise drafts, references and deadlines by matter.
            </p>
          </div>
          {!isForbidden && (
            <Button className="gap-2" onClick={() => setOpen(true)} data-testid="button-new-matter">
              <FolderPlus className="h-4 w-4" /> New matter
            </Button>
          )}
        </div>

        {isForbidden ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Lock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-serif font-semibold text-lg text-foreground mb-1">Matter files require a subscriber access code</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {error instanceof ApiError ? error.message : ""} Demo and master access codes cannot create or view matter
                files. Sign in with a subscriber access code to organise your drafts into matters.
              </p>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : (matters?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-serif font-semibold text-lg text-foreground mb-1">No matter files yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                Create a matter to collect your drafts, or file a draft into a matter straight from any tool once
                you generate output.
              </p>
              <Button className="gap-2" onClick={() => setOpen(true)}>
                <FolderPlus className="h-4 w-4" /> Create your first matter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matters!.map((m) => (
              <Link key={m.id} href={`/workspace/matters/${m.id}`}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full" data-testid={`card-matter-${m.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-serif font-semibold text-foreground truncate">{m.title}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${statusColor(m.status)}`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {m.reference && (
                        <div className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> {m.reference}</div>
                      )}
                      {m.clientName && (
                        <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {m.clientName}</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                      <span className="text-[11px] text-muted-foreground">Updated {fmtDate(m.updatedAt)}</span>
                      <ArrowRight className="h-4 w-4 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setExtractedFiles([]); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New matter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Matter title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Maybank v Ahmad — Loan Recovery" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Counterparty</Label>
                <Input value={form.counterparty} onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Matter type</Label>
              <Input value={form.matterType} onChange={(e) => setForm((f) => ({ ...f, matterType: e.target.value }))} placeholder="e.g. Loan recovery" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Supporting Documents <span className="font-normal text-muted-foreground text-xs">(optional — AI will read these)</span></Label>
              <MatterFileUpload onFilesExtracted={setExtractedFiles} />
            </div>
            <p className="text-xs text-muted-foreground">A file reference is generated automatically.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setExtractedFiles([]); }}>Cancel</Button>
            <Button onClick={submitCreate} disabled={createMatter.isPending}>Create matter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}
