import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderKanban, FolderPlus, Check, Loader2, ArrowRight } from "lucide-react";
import {
  useMatters,
  useCreateMatter,
  useSaveWork,
  generateFileRef,
} from "@/hooks/use-matters";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Shown after an AI output completes: turns the working session into a matter
 * file (create new or file into existing), so the draft/analysis is kept with
 * the client's brief instead of being lost when the page closes.
 */
export function SaveToMatterPanel({
  draftTitle,
  draftContent,
  defaultMatterTitle,
  kind = "draft",
  inputJson,
  sourceLabel = "Document Drafter",
}: {
  draftTitle: string;
  draftContent: string;
  defaultMatterTitle?: string;
  kind?: string;
  inputJson?: unknown;
  sourceLabel?: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: matters } = useMatters();
  const createMatter = useCreateMatter();
  const saveWork = useSaveWork();

  const [mode, setMode] = useState<"idle" | "new" | "existing">("idle");
  const [title, setTitle] = useState(defaultMatterTitle ?? "");
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
      inputJson,
    });
    qc.invalidateQueries({ queryKey: ["acc-matters", "work", matterId] });
    setSavedMatter({ id: matterId, title: matterTitle });
    toast({ title: "Filed into matter", description: `Saved “${draftTitle}” to ${matterTitle}.` });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const matter = await createMatter.mutateAsync({
        title: title.trim(),
        fileRef: generateFileRef(),
        status: "open",
        notes: `Opened from MyAccidentAI ${sourceLabel}.`,
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
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap" data-testid="panel-saved-to-matter">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="h-4 w-4" /> Filed into <span className="font-semibold">{savedMatter.title}</span>
        </div>
        <Link href={`/workspace/matters/${savedMatter.id}`}>
          <Button size="sm" variant="outline" className="gap-1.5 text-emerald-400 border-emerald-500/40" data-testid="button-open-matter">
            Open matter file <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3" data-testid="panel-save-to-matter">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <FolderKanban className="h-4 w-4" /> Save this into a matter file?
      </p>
      <p className="text-xs text-muted-foreground">
        The matter file keeps all your drafts and analyses for a brief together, and tracks the key
        accident-claim deadlines (police report, insurer notice under s.96 RTA, limitation, pleadings).
      </p>

      {mode === "idle" && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setMode("new")} className="gap-1.5" data-testid="button-new-matter">
            <FolderPlus className="h-3.5 w-3.5" /> Create new matter
          </Button>
          {(matters?.length ?? 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode("existing")} className="gap-1.5" data-testid="button-existing-matter">
              <FolderKanban className="h-3.5 w-3.5" /> File into existing matter
            </Button>
          )}
        </div>
      )}

      {mode === "new" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Matter title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lim v Tan — Running Down Claim"
            data-testid="input-matter-title"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy || !title.trim()} className="gap-1.5" data-testid="button-create-and-file">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
              Create &amp; file
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>Back</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">A file reference is generated automatically; deadlines can be computed from the matter page.</p>
        </div>
      )}

      {mode === "existing" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Choose matter</Label>
          <Select value={existingId} onValueChange={setExistingId}>
            <SelectTrigger data-testid="select-existing-matter">
              <SelectValue placeholder="Select a matter…" />
            </SelectTrigger>
            <SelectContent>
              {(matters ?? []).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExisting} disabled={busy || !existingId} className="gap-1.5" data-testid="button-file-here">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              File here
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
