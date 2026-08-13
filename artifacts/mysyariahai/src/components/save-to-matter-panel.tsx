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
import { useMatters, useCreateMatter, useFileWork } from "@/hooks/use-matters";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";

function generateFileRef(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `SYA/${year}/${n}`;
}

/**
 * Shown after an AI draft/document completes: files the result into a matter
 * file (create new with an auto file reference, or file into an existing one).
 */
export function SaveToMatterPanel({
  draftTitle,
  draftContent,
  parties,
  kind = "draft",
  matterType,
}: {
  draftTitle: string;
  draftContent: string;
  parties?: string;
  kind?: string;
  matterType?: string;
}) {
  const { t, ts } = useLanguage();
  const { toast } = useToast();
  const { data: matters } = useMatters();
  const createMatter = useCreateMatter();
  const fileWork = useFileWork();

  const [mode, setMode] = useState<"idle" | "new" | "existing">("idle");
  const [title, setTitle] = useState(parties || draftTitle);
  const [existingId, setExistingId] = useState<string>("");
  const [savedMatter, setSavedMatter] = useState<{ id: number; title: string } | null>(null);

  const busy = createMatter.isPending || fileWork.isPending;

  const fileDraft = async (matterId: number, matterTitle: string) => {
    await fileWork.mutateAsync({ matterId, kind, title: draftTitle, content: draftContent });
    setSavedMatter({ id: matterId, title: matterTitle });
    toast({
      title: ts("Filed into matter", "Difailkan ke dalam fail kes"),
      description: ts(
        `Saved "${draftTitle}" to ${matterTitle}.`,
        `"${draftTitle}" disimpan ke ${matterTitle}.`,
      ),
    });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const fileRef = generateFileRef();
      const matter = await createMatter.mutateAsync({
        title: title.trim(),
        clientName: parties || null,
        matterType: matterType || null,
        status: "active",
        notes: `${ts("File Ref", "No. Fail")}: ${fileRef}\n${ts("Opened from MySyariahAI drafting.", "Dibuka daripada penjanaan draf MySyariahAI.")}`,
      });
      await fileDraft(matter.id, matter.title);
    } catch {
      toast({
        title: ts("Could not create matter", "Fail kes tidak dapat dibuka"),
        description: ts("Please try again.", "Sila cuba lagi."),
        variant: "destructive",
      });
    }
  };

  const handleExisting = async () => {
    const id = parseInt(existingId, 10);
    if (!id) return;
    const m = (matters ?? []).find((x) => x.id === id);
    try {
      await fileDraft(id, m?.title ?? `#${id}`);
    } catch {
      toast({
        title: ts("Could not save to matter", "Tidak dapat disimpan ke fail kes"),
        description: ts("Please try again.", "Sila cuba lagi."),
        variant: "destructive",
      });
    }
  };

  if (savedMatter) {
    return (
      <div
        className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap"
        data-testid="save-to-matter-saved"
      >
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" />
          {t("Filed into", "Difailkan ke dalam")}{" "}
          <span className="font-semibold">{savedMatter.title}</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-emerald-300 border-emerald-800/40" asChild>
          <Link href={`/matters/${savedMatter.id}`}>
            {t("Open matter file", "Buka fail kes")} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className="bg-secondary/5 border border-secondary/20 rounded-xl p-4 space-y-3"
      data-testid="save-to-matter-panel"
    >
      <p className="text-sm font-semibold text-secondary flex items-center gap-2">
        <FolderKanban className="h-4 w-4" />
        {t("Save this draft into a matter file?", "Simpan draf ini ke dalam fail kes?")}
      </p>
      <p className="text-xs text-muted-foreground">
        {t(
          "The matter file keeps all your drafts together, tracks deadlines and links the relevant Syariah procedure.",
          "Fail kes mengumpulkan semua draf anda, menjejaki tarikh akhir dan memautkan tatacara Syariah yang berkaitan.",
        )}
      </p>

      {mode === "idle" && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setMode("new")} className="gap-1.5" data-testid="save-to-matter-new">
            <FolderPlus className="h-3.5 w-3.5" /> {t("Create new matter", "Buka fail kes baharu")}
          </Button>
          {(matters?.length ?? 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode("existing")} className="gap-1.5" data-testid="save-to-matter-existing">
              <FolderKanban className="h-3.5 w-3.5" /> {t("File into existing matter", "Failkan ke fail kes sedia ada")}
            </Button>
          )}
        </div>
      )}

      {mode === "new" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t("Matter title", "Tajuk fail kes")}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={ts("e.g. Siti Aminah lwn Ahmad — Tuntutan Nafkah", "cth. Siti Aminah lwn Ahmad — Tuntutan Nafkah")}
            data-testid="save-to-matter-title"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy || !title.trim()} className="gap-1.5" data-testid="save-to-matter-create">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
              {t("Create & file draft", "Buka & failkan draf")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              {t("Back", "Kembali")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t(
              "A file reference is generated automatically; deadlines can be computed from the matter page.",
              "Nombor fail dijana secara automatik; tarikh akhir boleh dikira dari halaman fail kes.",
            )}
          </p>
        </div>
      )}

      {mode === "existing" && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">{t("Choose matter", "Pilih fail kes")}</Label>
          <Select value={existingId} onValueChange={setExistingId}>
            <SelectTrigger data-testid="save-to-matter-select">
              <SelectValue placeholder={ts("Select a matter…", "Pilih fail kes…")} />
            </SelectTrigger>
            <SelectContent>
              {(matters ?? []).map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExisting} disabled={busy || !existingId} className="gap-1.5" data-testid="save-to-matter-file">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {t("File draft here", "Failkan draf di sini")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              {t("Back", "Kembali")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
