import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderKanban, FolderPlus, Check, Loader2, ArrowRight } from "lucide-react";
import { useMatters, useCreateMatter } from "@/hooks/use-matters";
import { useSaveWork } from "@/hooks/use-saved-work";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const FILE_REF_PREFIX = "MCL";

function generateFileRef(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${FILE_REF_PREFIX}/${year}/${n}`;
}

/**
 * Shown after an AI draft completes: turns the drafting output into a matter
 * file (create new with an auto file reference, or file into an existing one),
 * so the draft is stored against the matter.
 *
 * Pass `defaultMatterId` to pre-select an originating matter in "existing" mode.
 */
export function SaveToMatterPanel({
  draftTitle,
  draftContent,
  defaultMatterId,
}: {
  draftTitle: string;
  draftContent: string;
  defaultMatterId?: number | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: matters } = useMatters();
  const createMatter = useCreateMatter();
  const saveWork = useSaveWork();

  // If a defaultMatterId is supplied (came from Case Home), start in existing mode
  // pre-selecting that matter so the user only needs one click to file.
  const [mode, setMode] = useState<"idle" | "new" | "existing">(
    defaultMatterId ? "existing" : "idle",
  );
  const [title, setTitle] = useState(draftTitle);
  const [existingId, setExistingId] = useState<string>(
    defaultMatterId ? String(defaultMatterId) : "",
  );
  const [savedMatter, setSavedMatter] = useState<{ id: number; title: string } | null>(null);

  const busy = createMatter.isPending || saveWork.isPending;

  const fileDraft = async (matterId: number, matterTitle: string) => {
    await saveWork.mutateAsync({
      kind: "draft",
      title: draftTitle,
      matter: matterTitle,
      matterId,
      content: draftContent,
    });
    qc.invalidateQueries({ queryKey: ["matters", "work", matterId] });
    setSavedMatter({ id: matterId, title: matterTitle });
    toast({ title: "Filed into matter", description: `Saved “${draftTitle}” to ${matterTitle}.` });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const matter = await createMatter.mutateAsync({
        title: title.trim(),
        reference: generateFileRef(),
        matterType: draftTitle,
        status: "open",
        notes: `Opened from ${draftTitle} (AI drafting).`,
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
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-emerald-400">
          <Check className="h-4 w-4" /> Filed into <span className="font-semibold">{savedMatter.title}</span>
        </div>
        <Link href={`/matters/${savedMatter.id}`}>
          <Button size="sm" variant="outline" className="gap-1.5">
            Open matter file <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <FolderKanban className="h-4 w-4" /> Save this draft into a matter file?
      </p>
      <p className="text-xs text-muted-foreground">
        The matter file keeps all your drafts together against the client, counterparty and reference, and tracks its deadlines.
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Acme Bhd — Series A Financing" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy || !title.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
              Create &amp; file draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>Back</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">A file reference is generated automatically; deadlines can be added from the matter page.</p>
        </div>
      )}

      {mode === "existing" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Choose matter</Label>
          <select
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
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
