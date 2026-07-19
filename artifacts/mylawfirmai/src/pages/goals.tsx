import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListGoals, useCreateGoal, useUpdateGoal, useArchiveGoal, useAddKpi, useUpdateKpi, useDeleteKpi, useListUsers, useAiBuildGoal, getListGoalsQueryKey, getListTasksQueryKey, Goal, Kpi, AiGoalKpiDraft } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, MoreVertical, Edit2, Trash2, Sparkles, ArrowLeft, Loader2, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Link } from "wouter";
import { useT, useLabels, useLanguage, useFormatDate, type TFunc } from "@/lib/i18n";
import { downloadCsvSections, downloadXlsxSheets, type SheetSection } from "@/lib/exportSheet";

const makeGoalSchema = (t: TFunc) =>
  z.object({
    title: z.string().min(1, t("validation.titleRequired")),
    description: z.string().optional(),
    ownerId: z.string().optional(),
    timeframe: z.string().optional(),
    status: z.enum(["active", "achieved", "paused"]),
  });

const makeKpiSchema = (t: TFunc) =>
  z.object({
    name: z.string().min(1, t("validation.nameRequired")),
    unit: z.string().optional(),
    targetValue: z.coerce.number(),
    currentValue: z.coerce.number(),
    direction: z.enum(["up", "down"]),
  });

type GoalForm = z.infer<ReturnType<typeof makeGoalSchema>>;
type KpiForm = z.infer<ReturnType<typeof makeKpiSchema>>;

export default function GoalsPage() {
  const { data: goals, isLoading } = useListGoals();
  const { currentUser, isManager } = useAuth();
  const t = useT();
  const formatDate = useFormatDate();
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  // Only the non-archived goals shown on the page are exported.
  const exportGoals = useMemo(() => (goals ?? []).filter(g => !g.archived), [goals]);
  const exportReady = exportGoals.length > 0;

  const exportHeaders = () => [
    t("goals.export.goal"),
    t("goals.export.status"),
    t("goals.export.health"),
    t("goals.export.progress"),
    t("goals.export.owner"),
    t("goals.export.timeframe"),
    t("goals.export.deliverables"),
    t("goals.export.kpi"),
    t("goals.export.kpiCurrent"),
    t("goals.export.kpiTarget"),
    t("goals.export.kpiUnit"),
    t("goals.export.kpiDirection"),
    t("goals.export.kpiAttainment"),
  ];

  // Flatten the cascade: one row per KPI, repeating the goal columns; goals with
  // no KPIs still get a single row so they aren't dropped from the report.
  const buildRows = (): string[][] => {
    const rows: string[][] = [];
    for (const g of exportGoals) {
      const goalCols = [
        g.title,
        t(`goalStatus.${g.status}`),
        t(`health.${g.health}`),
        `${g.deliverableStats.progressPct}`,
        g.ownerName || t("common.unassigned"),
        g.timeframe || "",
        `${g.deliverableStats.total}`,
      ];
      if (g.kpis.length === 0) {
        rows.push([...goalCols, "", "", "", "", "", ""]);
      } else {
        for (const k of g.kpis) {
          rows.push([
            ...goalCols,
            k.name,
            `${k.currentValue}`,
            `${k.targetValue}`,
            k.unit || "",
            t(`goals.kpi.direction.${k.direction}`),
            `${k.attainmentPct}`,
          ]);
        }
      }
    }
    return rows;
  };

  // Second worksheet/section: one row per linked deliverable so managers can
  // drill into the actual tasks driving each goal's health. Goals with no
  // deliverables contribute no rows.
  const deliverableHeaders = () => [
    t("goals.export.goal"),
    t("goals.export.task"),
    t("goals.export.owner"),
    t("goals.export.status"),
    t("goals.export.dueDate"),
    t("goals.export.overdue"),
    t("goals.export.urgent"),
  ];

  const buildDeliverableRows = (): string[][] => {
    const rows: string[][] = [];
    const now = Date.now();
    for (const g of exportGoals) {
      for (const task of g.deliverables) {
        const overdue =
          !!task.dueAt &&
          new Date(task.dueAt).getTime() < now &&
          task.status !== "done";
        rows.push([
          g.title,
          task.title,
          task.ownerName || t("common.unassigned"),
          t(`status.${task.status}`),
          task.dueAt ? formatDate(task.dueAt, "yyyy-MM-dd") : "",
          overdue ? t("export.yes") : t("export.no"),
          task.category === "urgent" ? t("export.yes") : t("export.no"),
        ]);
      }
    }
    return rows;
  };

  const buildSections = (): SheetSection[] => [
    {
      title: t("goals.export.sheet"),
      headers: exportHeaders(),
      rows: buildRows(),
      columnWidths: [32, 12, 12, 11, 20, 14, 12, 28, 10, 10, 10, 16, 13],
    },
    {
      title: t("goals.export.deliverablesSheet"),
      headers: deliverableHeaders(),
      rows: buildDeliverableRows(),
      columnWidths: [32, 40, 20, 16, 14, 10, 10],
    },
  ];

  const filename = (ext: string) =>
    `mylawfirmai-goals-${formatDate(new Date().toISOString(), "yyyy-MM-dd")}.${ext}`;

  const handleExportCsv = () => {
    if (exporting) return;
    if (!exportReady) { toast(t("export.empty")); return; }
    setExporting("csv");
    try {
      downloadCsvSections(buildSections(), filename("csv"));
    } catch {
      toast.error(t("export.failed"));
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (exporting) return;
    if (!exportReady) { toast(t("export.empty")); return; }
    setExporting("xlsx");
    try {
      await downloadXlsxSheets(buildSections(), filename("xlsx"));
    } catch {
      toast.error(t("export.failed"));
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text">{t("goals.title")}</h1>
            <p className="text-muted-foreground mt-2 text-base font-medium">{t("goals.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isManager && (
              <>
                <Button
                  variant="outline"
                  className="font-semibold rounded-xl"
                  disabled={!!exporting || !exportReady}
                  onClick={handleExportCsv}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exporting === "csv" ? t("export.preparing") : t("export.downloadCsv")}
                </Button>
                <Button
                  variant="outline"
                  className="font-semibold rounded-xl"
                  disabled={!!exporting || !exportReady}
                  onClick={handleExportExcel}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exporting === "xlsx" ? t("export.preparing") : t("export.downloadExcel")}
                </Button>
              </>
            )}
            {isManager && <CreateGoalDialog />}
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-card/50 animate-pulse border shadow-sm" />
            ))}
          </div>
        ) : goals?.length === 0 ? (
          <div className="glass-card border-dashed border-2 border-border/60 rounded-2xl p-16 text-center flex flex-col items-center justify-center bg-gradient-to-b from-card/40 to-transparent">
            <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-6 shadow-sm ring-1 ring-primary/20">
              <Target className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-serif font-bold mb-3 text-foreground">{t("goals.emptyTitle")}</h2>
            <p className="text-muted-foreground max-w-md mb-8 text-base">
              {t("goals.emptyBody")}
            </p>
            {isManager && <CreateGoalDialog />}
          </div>
        ) : (
          <div className="space-y-8">
            {goals?.map(goal => (
              <GoalCard key={goal.id} goal={goal} isManager={isManager} currentUser={currentUser} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function CreateGoalDialog() {
  const [open, setOpen] = useState(false);
  const [aiMode, setAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [suggestedKpis, setSuggestedKpis] = useState<AiGoalKpiDraft[]>([]);
  const { currentUser } = useAuth();
  const t = useT();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const createGoal = useCreateGoal();
  const addKpi = useAddKpi();
  const aiBuild = useAiBuildGoal();
  const goalSchema = useMemo(() => makeGoalSchema(t), [t]);

  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: "",
      description: "",
      ownerId: "none",
      timeframe: "",
      status: "active",
    },
  });

  const resetAll = () => {
    form.reset();
    setAiMode(false);
    setAiPrompt("");
    setSuggestedKpis([]);
  };

  const handleGenerate = () => {
    if (!currentUser) return;
    if (!aiPrompt.trim()) {
      toast.error(t("goals.ai.emptyPrompt"));
      return;
    }
    aiBuild.mutate(
      { data: { prompt: aiPrompt.trim(), lang, actingUserId: currentUser.id } },
      {
        onSuccess: (draft) => {
          form.setValue("title", draft.title);
          form.setValue("description", draft.description ?? "");
          form.setValue("timeframe", draft.timeframe ?? "");
          setSuggestedKpis(draft.kpis);
          setAiMode(false);
          toast.success(t("goals.ai.applied"));
        },
        onError: () => toast.error(t("goals.ai.failed")),
      }
    );
  };

  const onSubmit = (values: GoalForm) => {
    if (!currentUser) return;
    createGoal.mutate(
      {
        data: {
          title: values.title,
          description: values.description || undefined,
          ownerId: values.ownerId && values.ownerId !== "none" ? parseInt(values.ownerId) : undefined,
          timeframe: values.timeframe || undefined,
          status: values.status as any,
          actingUserId: currentUser.id,
        }
      },
      {
        onSuccess: (goal) => {
          const kpisToAdd = suggestedKpis;
          if (kpisToAdd.length > 0) {
            Promise.allSettled(
              kpisToAdd.map((k) =>
                addKpi.mutateAsync({
                  id: goal.id,
                  data: {
                    name: k.name,
                    unit: k.unit ?? undefined,
                    targetValue: k.targetValue,
                    currentValue: k.currentValue ?? 0,
                    direction: k.direction as any,
                    actingUserId: currentUser.id,
                  },
                })
              )
            ).finally(() => {
              queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
            });
          }
          queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          toast.success(t("goals.toast.created"));
          setOpen(false);
          resetAll();
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetAll(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> {t("goals.newGoal")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{aiMode ? t("goals.ai.title") : t("goals.create")}</DialogTitle>
        </DialogHeader>

        {aiMode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("goals.ai.desc")}</p>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={t("goals.ai.placeholder")}
              className="h-32 resize-none"
            />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAiMode(false)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" /> {t("goals.ai.back")}
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={aiBuild.isPending} className="gap-2">
                {aiBuild.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiBuild.isPending ? t("goals.ai.generating") : t("goals.ai.generate")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                onClick={() => setAiMode(true)}
              >
                <Sparkles className="w-4 h-4" /> {t("goals.ai.button")}
              </Button>
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.field.title")}</FormLabel><FormControl><Input placeholder={t("goals.field.title.placeholder")} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.field.description")}</FormLabel><FormControl><Textarea placeholder={t("goals.field.description.placeholder")} className="h-20 resize-none" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="ownerId" render={({ field }) => (
                  <FormItem><FormLabel>{t("goals.field.owner")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder={t("goals.field.owner.placeholder")} /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                        {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="timeframe" render={({ field }) => (
                  <FormItem><FormLabel>{t("goals.field.timeframe.create")}</FormLabel><FormControl><Input placeholder={t("goals.field.timeframe.placeholder")} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              {suggestedKpis.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                    <Sparkles className="w-3.5 h-3.5" /> {t("goals.ai.kpisPreview")}
                  </div>
                  <ul className="space-y-1">
                    {suggestedKpis.map((k, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="font-medium">{k.name}</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          {k.direction === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {k.targetValue}{k.unit ? ` ${k.unit}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">{t("goals.ai.kpisNote")}</p>
                </div>
              )}
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => { setOpen(false); resetAll(); }}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={createGoal.isPending}>{t("goals.createBtn")}</Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditGoalDialog({ goal, open, onOpenChange }: { goal: Goal, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { currentUser } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const updateGoal = useUpdateGoal();
  const goalSchema = useMemo(() => makeGoalSchema(t), [t]);

  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: goal.title,
      description: goal.description || "",
      ownerId: goal.ownerId?.toString() || "none",
      timeframe: goal.timeframe || "",
      status: goal.status as any,
    },
  });

  const onSubmit = (values: GoalForm) => {
    if (!currentUser) return;
    updateGoal.mutate(
      {
        id: goal.id,
        data: {
          title: values.title,
          description: values.description || null,
          ownerId: values.ownerId && values.ownerId !== "none" ? parseInt(values.ownerId) : null,
          timeframe: values.timeframe || null,
          status: values.status as any,
          actingUserId: currentUser.id,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
          toast.success(t("goals.toast.updated"));
          onOpenChange(false);
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("goals.edit")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem><FormLabel>{t("goals.field.title")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem><FormLabel>{t("goals.field.description")}</FormLabel><FormControl><Textarea className="h-20 resize-none" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="ownerId" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.field.owner")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t("goals.field.owner.placeholder")} /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                      {users?.map(u => <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.field.status")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">{t("goalStatus.active")}</SelectItem>
                      <SelectItem value="paused">{t("goalStatus.paused")}</SelectItem>
                      <SelectItem value="achieved">{t("goalStatus.achieved")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="timeframe" render={({ field }) => (
              <FormItem><FormLabel>{t("goals.field.timeframe")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={updateGoal.isPending}>{t("goals.saveChanges")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function KpiDialog({ goalId, kpi, open, onOpenChange }: { goalId: number, kpi?: Kpi, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { currentUser } = useAuth();
  const t = useT();
  const queryClient = useQueryClient();
  const addKpi = useAddKpi();
  const updateKpi = useUpdateKpi();
  const kpiSchema = useMemo(() => makeKpiSchema(t), [t]);

  const form = useForm<KpiForm>({
    resolver: zodResolver(kpiSchema),
    defaultValues: {
      name: kpi?.name || "",
      unit: kpi?.unit || "",
      targetValue: kpi?.targetValue ?? 100,
      currentValue: kpi?.currentValue ?? 0,
      direction: kpi?.direction || "up",
    },
  });

  const onSubmit = (values: KpiForm) => {
    if (!currentUser) return;
    
    const data = {
      name: values.name,
      unit: values.unit || undefined,
      targetValue: values.targetValue,
      currentValue: values.currentValue,
      direction: values.direction as any,
      actingUserId: currentUser.id,
    };

    if (kpi) {
      updateKpi.mutate(
        { id: goalId, kpiId: kpi.id, data },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success(t("goals.toast.kpiUpdated")); onOpenChange(false); } }
      );
    } else {
      addKpi.mutate(
        { id: goalId, data },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success(t("goals.toast.kpiAdded")); onOpenChange(false); form.reset(); } }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{kpi ? t("goals.kpi.edit") : t("goals.kpi.add")}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>{t("goals.kpi.name")}</FormLabel><FormControl><Input placeholder={t("goals.kpi.name.placeholder")} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.kpi.unit")}</FormLabel><FormControl><Input placeholder={t("goals.kpi.unit.placeholder")} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="direction" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.kpi.direction")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="up">{t("goals.kpi.direction.up")}</SelectItem>
                      <SelectItem value="down">{t("goals.kpi.direction.down")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="currentValue" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.kpi.current")}</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="targetValue" render={({ field }) => (
                <FormItem><FormLabel>{t("goals.kpi.target")}</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={addKpi.isPending || updateKpi.isPending}>{kpi ? t("goals.kpi.save") : t("goals.kpi.add")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, isManager, currentUser }: { goal: Goal, isManager: boolean, currentUser: any }) {
  const t = useT();
  const labels = useLabels();
  const queryClient = useQueryClient();
  const archiveGoal = useArchiveGoal();
  const deleteKpi = useDeleteKpi();
  
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [addKpiOpen, setAddKpiOpen] = useState(false);
  const [editingKpi, setEditingKpi] = useState<Kpi | undefined>();

  const handleArchive = () => {
    if (!currentUser) return;
    if (confirm(t("goals.confirm.archive"))) {
      archiveGoal.mutate(
        { id: goal.id, data: { actingUserId: currentUser.id } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success(t("goals.toast.archived")); } }
      );
    }
  };

  const handleDeleteKpi = (kpiId: number) => {
    if (!currentUser) return;
    if (confirm(t("goals.confirm.deleteKpi"))) {
      deleteKpi.mutate(
        { id: goal.id, kpiId, data: { actingUserId: currentUser.id } },
        { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() }); toast.success(t("goals.toast.kpiDeleted")); } }
      );
    }
  };

  // Group deliverables by owner
  const deliverablesByOwner = goal.deliverables.reduce((acc, task) => {
    const owner = task.ownerName || t("common.unassigned");
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(task);
    return acc;
  }, {} as Record<string, typeof goal.deliverables>);

  return (
    <Card className={`glass-card overflow-hidden transition-all duration-300 border-l-[6px] ${
      goal.health === "at_risk" ? "border-l-destructive shadow-destructive/5" :
      goal.health === "achieved" ? "border-l-green-500 shadow-green-500/5" :
      "border-l-primary shadow-primary/5"
    }`}>
      <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent pb-5 border-b border-border/40">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant={goal.status === "active" ? "default" : "secondary"} className="font-medium shadow-sm">
                {t(`goalStatus.${goal.status}`)}
              </Badge>
              {goal.health === "at_risk" && (
                <Badge variant="destructive" className="flex items-center gap-1.5 font-medium shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t("health.at_risk")}
                </Badge>
              )}
              {goal.health === "achieved" && (
                <Badge className="bg-green-600 hover:bg-green-700 flex items-center gap-1.5 font-medium shadow-sm text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t("health.achieved")}
                </Badge>
              )}
              {goal.timeframe && (
                <Badge variant="outline" className="text-muted-foreground font-medium bg-background/50">
                  {goal.timeframe}
                </Badge>
              )}
            </div>
            <CardTitle className="text-3xl font-serif font-bold text-foreground tracking-tight">{goal.title}</CardTitle>
            {goal.ownerName && (
              <CardDescription className="mt-2 font-medium text-muted-foreground/80 flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold ring-1 ring-primary/20">
                  {goal.ownerName.charAt(0).toUpperCase()}
                </div>
                {t("goals.ownedBy", { name: goal.ownerName })}
              </CardDescription>
            )}
          </div>
          
          {isManager && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="-mr-2 h-9 w-9 hover:bg-background/50"><MoreVertical className="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 font-medium">
                <DropdownMenuItem onClick={() => setEditGoalOpen(true)}><Edit2 className="w-4 h-4 mr-2" /> {t("goals.menu.edit")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddKpiOpen(true)}><Target className="w-4 h-4 mr-2" /> {t("goals.menu.addKpi")}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchive} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" /> {t("goals.menu.archive")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {goal.description && <p className="text-base text-muted-foreground mt-5 max-w-3xl leading-relaxed">{goal.description}</p>}
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-border/40">
          {/* KPIs Section */}
          <div className="p-6 col-span-1 bg-muted/20">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("goals.keyMetrics")}</h3>
              {isManager && (
                <Button variant="outline" size="sm" className="h-7 text-xs px-3 bg-background/50 hover:bg-background" onClick={() => setAddKpiOpen(true)}>
                  <Plus className="w-3 h-3 mr-1.5" /> {t("common.add")}
                </Button>
              )}
            </div>
            
            {goal.kpis.length === 0 ? (
              <div className="text-sm font-medium text-muted-foreground/60 italic p-4 bg-background/30 rounded-lg border border-dashed border-border/50">{t("goals.noKpis")}</div>
            ) : (
              <div className="space-y-4">
                {goal.kpis.map(kpi => (
                  <div key={kpi.id} className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm text-foreground/90">{kpi.name}</span>
                      {isManager && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1 hover:bg-muted/50"><MoreVertical className="w-3 h-3" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="font-medium">
                            <DropdownMenuItem onClick={() => setEditingKpi(kpi)}>{t("goals.kpi.updateValue")}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteKpi(kpi.id)} className="text-destructive focus:text-destructive">{t("common.delete")}</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-3xl font-serif font-bold leading-none">{kpi.currentValue}{kpi.unit}</span>
                      <span className="text-xs font-medium text-muted-foreground mb-1">/ {kpi.targetValue}{kpi.unit}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          {kpi.direction === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {t("goals.kpi.attainment", { pct: Math.round(kpi.attainmentPct) })}
                        </span>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, kpi.attainmentPct))} className="h-2 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Deliverables Section */}
          <div className="p-6 col-span-1 md:col-span-2 bg-background/40">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("goals.deliverables")}</h3>
              <div className="text-sm font-bold bg-muted px-2.5 py-0.5 rounded-md text-foreground/80">
                {t("goals.deliverables.done", { count: `${goal.deliverableStats.done} / ${goal.deliverableStats.total}` })}
              </div>
            </div>
            
            <div className="mb-8">
              <Progress value={goal.deliverableStats.progressPct} className="h-2.5 mb-3 rounded-full shadow-inner" />
              <div className="flex gap-5 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/20"></span>
                  {goal.deliverableStats.done} {t("goals.deliverables.doneLabel")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-orange-500/20"></span>
                  {goal.deliverableStats.blocked} {t("goals.deliverables.blocked")}
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-destructive/20"></span>
                  {goal.deliverableStats.overdue} {t("goals.deliverables.overdue")}
                </span>
              </div>
            </div>

            {Object.keys(deliverablesByOwner).length === 0 ? (
              <div className="text-sm text-muted-foreground italic">{t("goals.deliverables.empty")}</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-4">
                {Object.entries(deliverablesByOwner).map(([owner, tasks]) => (
                  <div key={owner} className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{owner}</div>
                    <div className="space-y-2">
                      {tasks.map(task => (
                        <Link key={task.id} href={`/task/${task.id}`}>
                          <div className="group flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 border border-transparent hover:border-border transition-colors cursor-pointer">
                            <div className="mt-0.5">
                              {task.status === "done" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                               task.status === "blocked" ? <AlertTriangle className="w-4 h-4 text-orange-500" /> :
                               <div className="w-4 h-4 rounded-full border-2 border-primary/30" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate font-medium ${task.status === "done" ? "text-muted-foreground line-through" : "text-foreground group-hover:text-primary transition-colors"}`}>
                                {task.title}
                              </p>
                              <div className="flex gap-2 mt-1">
                                {task.category === "urgent" && <Badge variant="destructive" className="px-1 text-[10px] h-4 leading-none">{labels.category("urgent")}</Badge>}
                                <Badge variant="outline" className="px-1 text-[10px] h-4 leading-none">{labels.status(task.status)}</Badge>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      {editGoalOpen && <EditGoalDialog goal={goal} open={editGoalOpen} onOpenChange={setEditGoalOpen} />}
      {addKpiOpen && <KpiDialog goalId={goal.id} open={addKpiOpen} onOpenChange={setAddKpiOpen} />}
      {editingKpi && <KpiDialog goalId={goal.id} kpi={editingKpi} open={!!editingKpi} onOpenChange={(open) => !open && setEditingKpi(undefined)} />}
    </Card>
  );
}
