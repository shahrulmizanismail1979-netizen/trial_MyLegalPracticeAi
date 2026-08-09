import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderKanban, FolderPlus, Check, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useMatters,
  useCreateMatter,
  useSaveWork,
  generateFileRef,
} from "@/hooks/use-matters";

/**
 * Shown after an AI draft completes: turns the drafting session into a
 * matter file (create new with an auto file reference, or file into an
 * existing matter). On success, shows a link to the matter file.
 */
export function SaveToMatterPanel({
  draftTitle,
  draftContent,
  kind = "draft",
  refPrefix = "CCB",
}: {
  draftTitle: string;
  draftContent: string;
  kind?: string;
  refPrefix?: string;
}) {
  const { toast } = useToast();
  const { data: matters } = useMatters();
  const createMatter = useCreateMatter();
  const saveWork = useSaveWork();

  const [mode, setMode] = useState<"idle" | "new" | "existing">("idle");
  const [title, setTitle] = useState(draftTitle);
  const [existingId, setExistingId] = useState<string>("");
  const [savedMatter, setSavedMatter] = useState<{ id: number; title: string } | null>(null);

  const busy = createMatter.isPending || saveWork.isPending;

  const fileDraft = async (matterId: number, matterTitle: string) => {
    await saveWork.mutateAsync({
      kind,
      title: draftTitle,
      matter: matterTitle,
      matterId,
      content: draftContent,
    });
    setSavedMatter({ id: matterId, title: matterTitle });
    toast({ title: "Filed into matter", description: `Saved "${draftTitle}" to ${matterTitle}.` });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const matter = await createMatter.mutateAsync({
        title: title.trim(),
        reference: generateFileRef(refPrefix),
        status: "open",
      });
      await fileDraft(matter.id, matter.title);
    } catch {
      toast({ title: "Could not create matter", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleExisting = async () => {
    const id = parseInt(existingId, 10);
    if (!id) return;
    const m = (matters ?? []).find((x) => x.id === id);
    try {
      await fileDraft(id, m?.title ?? `Matter #${id}`);
    } catch {
      toast({ title: "Could not save to matter", description: "Please try again.", variant: "destructive" });
    }
  };

  if (savedMatter) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-primary">
          <Check className="h-4 w-4" /> Filed into <span className="font-semibold">{savedMatter.title}</span>
        </div>
        <Link href={`/workspace/matters/${savedMatter.id}`}>
          <Button size="sm" variant="outline" className="gap-1.5">
            Open matter file <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <FolderKanban className="h-4 w-4" /> Save this draft into a matter file?
      </p>
      <p className="text-xs text-muted-foreground">
        A matter file keeps all your drafts together, records a file reference and tracks deadlines.
      </p>

      {mode === "idle" && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setMode("new")} className="gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Create new matter
          </Button>
          {(matters?.length ?? 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode("existing")} className="gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" /> File into existing matter
            </Button>
          )}
        </div>
      )}

      {mode === "new" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Matter title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Maybank v Ahmad — Loan Recovery" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy || !title.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
              Create &amp; file draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>Back</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">A file reference is generated automatically.</p>
        </div>
      )}

      {mode === "existing" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Choose matter</Label>
          <select
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
          >
            <option value="">Select a matter…</option>
            {(matters ?? []).map((m) => (
              <option key={m.id} value={String(m.id)}>{m.title}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExisting} disabled={busy || !existingId} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              File draft here
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
