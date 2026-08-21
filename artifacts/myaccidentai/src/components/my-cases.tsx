import { useState } from "react";
import { Link } from "wouter";
import {
  useCaseBriefing,
  usePrepareMatter,
  ApiError,
  type MatterBriefing,
} from "@/hooks/use-matters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const MATTER_TYPE_LABELS: Record<string, string> = {
  "running-down": "Running Down (motor)",
  "personal-injury": "Personal Injury",
  fatal: "Fatal Accident / Dependency",
  mib: "MIB Claim",
  other: "Other",
};

function matterTypeLabel(v: string | null) {
  if (!v) return "";
  return MATTER_TYPE_LABELS[v] ?? v;
}

function isClosed(status: string | null) {
  return status ? status.toLowerCase() === "closed" : false;
}

function fmtDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function PrepareButton({ m }: { m: MatterBriefing }) {
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
        title: "Preparation failed",
        description: e instanceof ApiError ? e.message : "Please try again.",
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
      <Button size="sm" className="gap-1.5" onClick={openDialog} data-testid={`my-case-prepare-${m.id}`}>
        <Sparkles className="h-3.5 w-3.5" /> Prepare with AI
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif">
              <Sparkles className="h-5 w-5 text-primary" />
              Prepare: <span className="font-normal text-muted-foreground truncate">{m.next_step.label}</span>
            </DialogTitle>
          </DialogHeader>

          {prepare.isPending && (
            <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
              Generating a preparation briefing for this step — this can take up to a minute…
            </div>
          )}

          {!prepare.isPending && prepare.isError && (
            <div className="space-y-3 py-4">
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Could not generate the briefing.
                </div>
                <p className="mt-1 text-destructive/80">
                  {prepare.error instanceof ApiError ? prepare.error.message : "Please try again."}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={run} data-testid={`my-case-prepare-retry-${m.id}`}>
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
            </div>
          )}

          {!prepare.isPending && markdown != null && (
            <div className="space-y-3">
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap p-4 bg-background border border-border rounded max-h-[55vh] overflow-auto"
                data-testid={`my-case-prepare-output-${m.id}`}
              >
                {markdown}
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={run} data-testid={`my-case-prepare-rerun-${m.id}`}>
                <RefreshCw className="h-4 w-4" /> Re-run
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CaseRow({ m }: { m: MatterBriefing }) {
  const closed = isClosed(m.status);
  const overdue = m.overdue_count > 0;

  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors group ${closed ? "opacity-55" : ""}`}
      data-testid={`my-case-${m.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={`/workspace/matters/${m.id}`} className="min-w-0 flex-1">
          <h3 className="font-serif font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors cursor-pointer">
            {m.title}
          </h3>
        </Link>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {m.status && (
            <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">
              {m.status}
            </span>
          )}
          {m.matter_type && (
            <span className="text-[10px] text-muted-foreground text-right">{matterTypeLabel(m.matter_type)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {m.stage_index >= 0 && m.stage_count > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <Milestone className="h-3.5 w-3.5 text-primary" /> Stage {m.stage_index + 1}/{m.stage_count}
          </span>
        )}
        {m.checklist_total > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <CheckSquare className="h-3.5 w-3.5 text-primary" /> {m.checklist_done}/{m.checklist_total}
          </span>
        )}
        {m.next_deadline && (
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> {m.next_deadline.title} · {fmtDate(m.next_deadline.due_date)}
          </span>
        )}
        {overdue && (
          <span className="inline-flex items-center gap-1 font-bold text-destructive">
            <AlertTriangle className="h-3 w-3" /> {m.overdue_count} overdue
          </span>
        )}
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <div className="flex items-start gap-2">
          <ListChecks className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-foreground/90 leading-relaxed">
            <span className="font-semibold text-primary">Next: </span>
            {m.next_step.label}
            {m.next_step.due_date && <span className="text-muted-foreground"> · {fmtDate(m.next_step.due_date)}</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-0.5">
        <PrepareButton m={m} />
        <Button variant="ghost" size="sm" className="ml-auto gap-1.5 text-primary" data-testid={`my-case-open-${m.id}`} asChild>
          <Link href={`/workspace/matters/${m.id}`}>
            Continue in Case Home <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function MyCases() {
  const { data, isLoading, isError, error, refetch } = useCaseBriefing();

  return (
    <section className="space-y-4" data-testid="my-cases-section">
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-serif font-bold text-foreground">My Cases</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse space-y-3">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="h-3 w-1/2 bg-muted rounded" />
              <div className="h-10 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="bg-card border border-destructive/30 rounded-xl p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">
            {error instanceof ApiError ? error.message : "Could not load your cases."}
          </p>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => refetch()} data-testid="my-cases-retry">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : !data || data.matters.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-serif font-semibold text-foreground mb-1">No matters yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
            Open a matter file to start tracking stages, deadlines and next steps.
          </p>
          <Button size="sm" className="gap-2" data-testid="my-cases-create" asChild>
            <Link href="/workspace/matters">Create a matter <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
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
