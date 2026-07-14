import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Scale,
  Loader2,
  CircleAlert,
  Compass,
  FileSignature,
  CalendarPlus,
  GitBranch,
  Check,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StreamOutput } from "@/components/StreamOutput";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getAppealPathways,
  getForumRoute,
  runAppealDraft,
  listMatters,
  addDeadlinesBulk,
  type ForumResult,
  type AppealPathway,
  type AppealDraftInput,
  type DeadlineInput,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]";

type Tab = "router" | "draft" | "timeline" | "library";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Appeals() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("router");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["appeal-pathways"],
    queryFn: getAppealPathways,
  });

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "router", label: t("apl.tab.router"), icon: Compass },
    { id: "draft", label: t("apl.tab.draft"), icon: FileSignature },
    { id: "timeline", label: t("apl.tab.timeline"), icon: CalendarPlus },
    { id: "library", label: t("apl.tab.library"), icon: GitBranch },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">
          {t("apl.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">{t("apl.desc")}</p>
        <div className="rule-gold mt-4" />
      </div>

      <div className="flex gap-2 mb-6 border-b border-border flex-wrap">
        {tabs.map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[hsl(var(--gold-bright))] text-[hsl(var(--gold-bright))]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tb.icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> {t("common.errorRetry")}
        </div>
      )}

      {data && tab === "router" && <ForumRouter />}
      {data && tab === "draft" && <AppealDrafter pathways={data.pathways} />}
      {data && tab === "timeline" && <AppealTimeline pathways={data.pathways} />}
      {data && tab === "library" && <PathwayLibrary pathways={data.pathways} />}
    </div>
  );
}

// ── Forum router ─────────────────────────────────────────────────────────────
function ForumRouter() {
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState<ForumResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const route = async () => {
    const n = Number(amount);
    if (!amount.trim() || Number.isNaN(n) || n < 0) {
      setErr(t("apl.router.invalid"));
      setResult(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      setResult(await getForumRoute(n));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">{t("apl.router.desc")}</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Label>{t("apl.router.amount")}</Label>
            <Input
              className="mt-1"
              inputMode="decimal"
              placeholder="e.g. 850000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && route()}
            />
          </div>
          <Button onClick={route} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Compass className="h-4 w-4" />}
            {t("apl.router.button")}
          </Button>
        </div>
        {err && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" />
            {err}
          </div>
        )}
        {result && (
          <div className="rounded-lg border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.06)] p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-[hsl(var(--gold-bright))]" />
              <h3 className="font-serif text-xl font-semibold text-foreground">
                {result.forum.name}
              </h3>
            </div>
            <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground">
              {result.forum.statute}
            </span>
            <p className="text-sm text-foreground/85">{result.rationale}</p>
            <p className="text-xs text-muted-foreground">{result.forum.scope}</p>
            <p className="flex items-start gap-1.5 text-xs text-amber-400/90 pt-1">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {result.note}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Cause-paper drafter ──────────────────────────────────────────────────────
function AppealDrafter({ pathways }: { pathways: AppealPathway[] }) {
  const { t } = useLanguage();
  const [pathwayId, setPathwayId] = useState("");
  const [causePaperId, setCausePaperId] = useState("");
  const [f, setF] = useState({
    court: "",
    parties: "",
    decision: "",
    grounds: "",
    questionsOfLaw: "",
    additionalDetails: "",
  });
  const [out, setOut] = useState("");
  const [disc, setDisc] = useState<string | undefined>();
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pathway = useMemo(() => pathways.find((p) => p.id === pathwayId), [pathways, pathwayId]);
  const causePaper = useMemo(
    () => pathway?.causePapers.find((c) => c.id === causePaperId),
    [pathway, causePaperId],
  );

  const run = () => {
    if (!pathwayId || !causePaperId) return;
    setGen(true);
    setOut("");
    setDisc(undefined);
    setErr(null);
    const input: AppealDraftInput = { pathwayId, causePaperId, ...f };
    runAppealDraft(input, {
      onContent: (c) => setOut((p) => p + c),
      onDone: (d) => {
        setDisc(d);
        setGen(false);
      },
      onError: (m) => {
        setErr(m);
        setGen(false);
      },
    });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">{t("apl.draft.desc")}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{t("apl.draft.pathway")}</Label>
            <select
              className={`${selectCls} mt-1`}
              value={pathwayId}
              onChange={(e) => {
                setPathwayId(e.target.value);
                setCausePaperId("");
              }}
            >
              <option value="">{t("apl.draft.selectPathway")}</option>
              {pathways.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("apl.draft.causePaper")}</Label>
            <select
              className={`${selectCls} mt-1`}
              value={causePaperId}
              onChange={(e) => setCausePaperId(e.target.value)}
              disabled={!pathway}
            >
              <option value="">{t("apl.draft.selectCausePaper")}</option>
              {(pathway?.causePapers ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {causePaper && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <FileSignature className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span>
              <span className="font-mono text-[11px] text-primary/80">{causePaper.basis}</span>{" "}
              — {causePaper.description}
            </span>
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{t("apl.draft.court")}</Label>
            <Input className="mt-1" value={f.court} onChange={(e) => setF({ ...f, court: e.target.value })} />
          </div>
          <div>
            <Label>{t("apl.draft.parties")}</Label>
            <Input className="mt-1" value={f.parties} onChange={(e) => setF({ ...f, parties: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>{t("apl.draft.decision")}</Label>
          <Textarea
            className="mt-1"
            rows={2}
            placeholder={t("apl.draft.decisionHint")}
            value={f.decision}
            onChange={(e) => setF({ ...f, decision: e.target.value })}
          />
        </div>
        <div>
          <Label>{t("apl.draft.grounds")}</Label>
          <Textarea
            className="mt-1"
            rows={3}
            placeholder={t("apl.draft.groundsHint")}
            value={f.grounds}
            onChange={(e) => setF({ ...f, grounds: e.target.value })}
          />
        </div>
        {pathway?.leaveRequired && (
          <div>
            <Label>{t("apl.draft.questions")}</Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder={t("apl.draft.questionsHint")}
              value={f.questionsOfLaw}
              onChange={(e) => setF({ ...f, questionsOfLaw: e.target.value })}
            />
          </div>
        )}
        <div>
          <Label>{t("apl.draft.additional")}</Label>
          <Textarea
            className="mt-1"
            rows={2}
            value={f.additionalDetails}
            onChange={(e) => setF({ ...f, additionalDetails: e.target.value })}
          />
        </div>

        <Button onClick={run} disabled={gen || !pathwayId || !causePaperId} className="w-full gap-2">
          {gen ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {t("apl.draft.drafting")}
            </>
          ) : (
            <>
              <FileSignature className="h-4 w-4" /> {t("apl.draft.button")}
            </>
          )}
        </Button>
        {err && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" />
            {err}
          </div>
        )}
        {out && (
          <StreamOutput
            output={out}
            disclaimer={disc}
            generating={gen}
            saveKind="appeal"
            saveTitle={causePaper?.name || t("apl.title")}
            saveLabel={t("apl.title")}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Timeline → deadline diary ────────────────────────────────────────────────
function AppealTimeline({ pathways }: { pathways: AppealPathway[] }) {
  const { t } = useLanguage();
  const matters = useQuery({ queryKey: ["matters"], queryFn: listMatters });

  const [pathwayId, setPathwayId] = useState("");
  const [anchor, setAnchor] = useState("");
  const [matterId, setMatterId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pathway = useMemo(() => pathways.find((p) => p.id === pathwayId), [pathways, pathwayId]);

  const computed = useMemo(() => {
    if (!pathway || !anchor) return [];
    const base = new Date(anchor);
    if (Number.isNaN(base.getTime())) return [];
    return pathway.timeline.map((s) => {
      const due = new Date(base);
      due.setDate(due.getDate() + s.offsetDays);
      return { ...s, dueDate: due };
    });
  }, [pathway, anchor]);

  const addToMatter = async () => {
    if (!pathway || computed.length === 0 || !matterId) return;
    setBusy(true);
    setErr(null);
    setDone(false);
    try {
      const deadlines: DeadlineInput[] = computed.map((s) => ({
        title: s.label,
        dueDate: s.dueDate.toISOString().slice(0, 10),
        category: s.category,
        basis: s.basis,
        notes: s.notes,
      }));
      await addDeadlinesBulk(Number(matterId), deadlines);
      setDone(true);
    } catch (e) {
      const m = (e as Error).message;
      setErr(
        m === "AUTH_REQUIRED"
          ? t("apl.timeline.authRequired")
          : m === "SUBSCRIPTION_REQUIRED"
            ? t("apl.timeline.subRequired")
            : m,
      );
    } finally {
      setBusy(false);
    }
  };

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">{t("apl.timeline.desc")}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{t("apl.timeline.pathway")}</Label>
            <select
              className={`${selectCls} mt-1`}
              value={pathwayId}
              onChange={(e) => {
                setPathwayId(e.target.value);
                setDone(false);
              }}
            >
              <option value="">{t("apl.draft.selectPathway")}</option>
              {pathways.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.shortName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{pathway ? pathway.anchorLabel : t("apl.timeline.anchor")}</Label>
            <Input
              type="date"
              className="mt-1"
              value={anchor}
              onChange={(e) => {
                setAnchor(e.target.value);
                setDone(false);
              }}
            />
          </div>
        </div>

        {computed.length > 0 && (
          <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
            {computed.map((s, i) => (
              <div key={i} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{s.basis}</p>
                  {s.notes && (
                    <p className="text-[11px] text-foreground/60 mt-0.5 leading-snug">{s.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-[hsl(var(--gold-bright))]">{fmt(s.dueDate)}</p>
                  <p className="text-[10px] text-muted-foreground">+{s.offsetDays} {t("apl.timeline.days")}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {computed.length > 0 && (
          <div className="flex gap-3 items-end flex-wrap pt-1">
            <div className="flex-1 min-w-[220px]">
              <Label>{t("apl.timeline.matter")}</Label>
              <select
                className={`${selectCls} mt-1`}
                value={matterId}
                onChange={(e) => setMatterId(e.target.value)}
              >
                <option value="">{t("apl.timeline.selectMatter")}</option>
                {(matters.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                    {m.suitNo ? ` — ${m.suitNo}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={addToMatter} disabled={busy || !matterId} className="gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {t("apl.timeline.add")}
            </Button>
          </div>
        )}

        {matters.isError && (
          <p className="text-xs text-muted-foreground">{t("apl.timeline.signInToLoad")}</p>
        )}
        {err && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlert className="h-4 w-4" />
            {err}
          </div>
        )}
        {done && (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" />
            {t("apl.timeline.added")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pathway library ──────────────────────────────────────────────────────────
function PathwayLibrary({ pathways }: { pathways: AppealPathway[] }) {
  const { t } = useLanguage();
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {pathways.map((p) => (
        <Card key={p.id}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-serif text-lg font-semibold text-foreground leading-tight">
                  {p.shortName}
                </h3>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                  p.leaveRequired
                    ? "border-amber-500/40 text-amber-400"
                    : "border-emerald-500/40 text-emerald-400"
                }`}
              >
                {p.leaveRequired ? t("apl.lib.leaveReq") : t("apl.lib.asOfRight")}
              </span>
            </div>
            <p className="text-sm text-foreground/85 leading-relaxed">{p.summary}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/70">{t("apl.lib.leaveNote")}: </span>
              {p.leaveNote}
            </p>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                {t("apl.lib.causePapers")}
              </p>
              <ul className="space-y-0.5">
                {p.causePapers.map((c) => (
                  <li key={c.id} className="text-xs text-foreground/75 leading-snug">
                    • {c.name}{" "}
                    <span className="font-mono text-[10px] text-muted-foreground">({c.basis})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-400 mb-1">
                <TriangleAlert className="h-3 w-3" /> {t("apl.lib.caveats")}
              </p>
              <ul className="space-y-0.5">
                {p.caveats.map((c, i) => (
                  <li key={i} className="text-[11px] text-foreground/70 leading-snug">
                    • {c}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
