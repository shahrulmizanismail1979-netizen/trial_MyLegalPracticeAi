import { useState } from "react";
import { Link } from "wouter";
import {
  useCaseBriefing,
  usePrepareMatter,
  matterTypeLabel,
  daysUntil,
  ApiError,
  type MatterBriefing,
} from "@/hooks/use-matters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-context";
import { useToast } from "@/hooks/use-toast";
import {
  Briefcase,
  ArrowRight,
  CalendarClock,
  AlertTriangle,
  CheckSquare,
  ListChecks,
  Sparkles,
  Loader2,
  RefreshCw,
  Milestone,
} from "lucide-react";

const CLOSED_STATUSES = new Set(["closed", "selesai"]);

function isClosed(status: string | null) {
  return status ? CLOSED_STATUSES.has(status.toLowerCase()) : false;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CaseRow({ m }: { m: MatterBriefing }) {
  const { t, mode } = useLanguage();
  const closed = isClosed(m.status);
  const overdue = m.overdue_count > 0;

  return (
    <Card
      className={`hover:border-secondary/50 transition-all group ${closed ? "opacity-55" : ""}`}
      data-testid={`my-case-${m.id}`}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/matters/${m.id}`} className="min-w-0 flex-1">
            <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-secondary transition-colors cursor-pointer">
              {m.title}
            </h3>
          </Link>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {m.status && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border text-secondary bg-secondary/10 border-secondary/20">
                {m.status}
              </span>
            )}
            {m.matter_type && (
              <span className="text-[10px] text-muted-foreground font-medium text-right">
                {matterTypeLabel(m.matter_type, mode)}
              </span>
            )}
          </div>
        </div>

        {/* progress indicators */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
          {m.stage_index >= 0 && m.stage_count > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Milestone className="h-3.5 w-3.5 text-secondary" />
              {t("Stage", "Peringkat")} {m.stage_index + 1}/{m.stage_count}
            </span>
          )}
          {m.checklist_total > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 text-secondary" />
              {m.checklist_done}/{m.checklist_total}
            </span>
          )}
          {m.next_deadline && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              {m.next_deadline.title} · {fmtDate(m.next_deadline.due_date)}
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center gap-1 font-bold text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {m.overdue_count} {t("overdue", "lewat")}
            </span>
          )}
        </div>

        {/* next step */}
        <div className="rounded-lg border border-secondary/20 bg-secondary/5 px-3 py-2">
          <div className="flex items-start gap-2">
            <ListChecks className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/90 leading-relaxed">
              <span className="font-semibold text-secondary">
                {t("Next", "Seterusnya")}:{" "}
              </span>
              {m.next_step.label}
              {m.next_step.due_date && (
                <span className="text-muted-foreground">
                  {" "}
                  · {fmtDate(m.next_step.due_date)}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <PrepareButton m={m} />
          <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-secondary" data-testid={`my-case-open-${m.id}`} asChild>
            <Link href={`/matters/${m.id}`}>
              {t("Open matter", "Buka fail")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PrepareButton({ m }: { m: MatterBriefing }) {
  const { t, ts } = useLanguage();
  const { toast } = useToast();
  const prepare = usePrepareMatter();
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);

  const run = async () => {
    setMarkdown(null);
    try {
      const res = await prepare.mutateAsync({ matterId: m.id, step: m.next_step.label });
      setMarkdown(res.preparation ?? "");
    } catch (e) {
      setMarkdown(null);
      toast({
        title: ts("Preparation failed", "Persediaan gagal"),
        description: e instanceof ApiError ? e.message : ts("Please try again.", "Sila cuba lagi."),
        variant: "destructive",
      });
    }
  };

  const openDialog = () => {
    setOpen(true);
    if (!markdown) run();
  };

  return (
    <>
      <Button
        size="sm"
        className="gap-1.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
        onClick={openDialog}
        data-testid={`my-case-prepare-${m.id}`}
      >
        <Sparkles className="h-3.5 w-3.5" /> {t("Prepare with AI", "Sedia dengan AI")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Sparkles className="h-5 w-5 text-secondary" />
              {t("Prepare: ", "Sedia: ")}
              <span className="font-normal text-muted-foreground truncate">{m.next_step.label}</span>
            </DialogTitle>
          </DialogHeader>

          {prepare.isPending && (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 text-secondary animate-spin shrink-0" />
              {t(
                "Generating a preparation briefing for this step… this can take up to a minute.",
                "Menjana taklimat persediaan untuk langkah ini… ini boleh mengambil masa sehingga seminit.",
              )}
            </div>
          )}

          {!prepare.isPending && prepare.isError && (
            <div className="space-y-3 py-4">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  {t("Could not generate the briefing.", "Taklimat tidak dapat dijana.")}
                </div>
                <p className="mt-1 text-red-400/80">
                  {prepare.error instanceof ApiError ? prepare.error.message : ts("Please try again.", "Sila cuba lagi.")}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={run} data-testid={`my-case-prepare-retry-${m.id}`}>
                <RefreshCw className="h-4 w-4" /> {t("Retry", "Cuba lagi")}
              </Button>
            </div>
          )}

          {!prepare.isPending && markdown != null && (
            <div className="space-y-3">
              <DraftExportButtons title={ts("Matter Preparation", "Persediaan Kes")} content={markdown} hideMarkdown />
              <div className="p-4 bg-card/50 border border-border rounded max-h-[55vh] overflow-auto" data-testid={`my-case-prepare-output-${m.id}`}>
                <DraftDocument content={markdown} />
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={run} data-testid={`my-case-prepare-rerun-${m.id}`}>
                <RefreshCw className="h-4 w-4" /> {t("Re-run", "Jana semula")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MyCases() {
  const { t } = useLanguage();
  const { data, isLoading, isError, error, refetch } = useCaseBriefing();

  return (
    <section className="space-y-4" data-testid="my-cases-section">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-secondary" />
        <h2 className="text-lg font-serif font-bold text-foreground">
          {t("My Cases", "Kes Saya")}
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
                <div className="h-10 w-full bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {error instanceof ApiError ? error.message : t("Could not load your cases.", "Kes anda tidak dapat dimuatkan.")}
            </p>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => refetch()} data-testid="my-cases-retry">
              <RefreshCw className="h-4 w-4" /> {t("Retry", "Cuba lagi")}
            </Button>
          </CardContent>
        </Card>
      ) : !data || data.matters.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-serif font-semibold text-foreground mb-1">
              {t("No matters yet", "Tiada fail kes lagi")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {t(
                "Open a matter file to start tracking stages, deadlines and next steps.",
                "Buka fail kes untuk mula menjejaki peringkat, tarikh akhir dan langkah seterusnya.",
              )}
            </p>
            <Button size="sm" className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground" data-testid="my-cases-create" asChild>
              <Link href="/matters">{t("Create a matter", "Buka fail kes")} <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.matters.map((m) => (
            <CaseRow key={m.id} m={m} />
          ))}
        </div>
      )}
    </section>
  );
}
