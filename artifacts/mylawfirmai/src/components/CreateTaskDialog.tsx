import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth";
import { useCreateTask, useListUsers, useListGoals, useAiTriageTask, getListTasksQueryKey, getGetDashboardQueryKey, getGetDigestQueryKey } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Sparkles, Loader2, Users, X } from "lucide-react";
import { userColor } from "@/lib/userColor";
import { toast } from "sonner";
import { useT, useLanguage, type TFunc } from "@/lib/i18n";
import { TaskRubricFields } from "@/components/TaskRubricFields";
import { assembleTitle, assembleDescription, type RubricSelection } from "@/lib/taskRubric";

const makeTaskSchema = (t: TFunc, mode: "guided" | "manual") =>
  z.object({
    title: mode === "manual" ? z.string().min(1, t("validation.titleRequired")) : z.string().optional().default(""),
    description: z.string().optional(),
    category: z.enum(["urgent", "backlog"]),
    reason: z.enum(["partner", "compliance", "manager", "client", "internal", "finance", "other"]),
    ownerId: z.string().optional(),
    goalId: z.string().optional(),
    dueAt: z.string().optional(),
  });

type TaskForm = z.infer<ReturnType<typeof makeTaskSchema>>;

const EMPTY_RUBRIC: RubricSelection = {
  positionLevel: null,
  actionVerb: null,
  qualityStandard: null,
  natureOfWork: null,
  businessUnit: null,
  deliverable: null,
};

export function CreateTaskDialog() {
  const [open, setOpen] = useState(false);
  const t = useT();
  const { currentUser, isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const { data: goals } = useListGoals();
  const createTask = useCreateTask();
  const triage = useAiTriageTask();
  const { lang } = useLanguage();
  const [rationale, setRationale] = useState<string | null>(null);
  const [mode, setMode] = useState<"guided" | "manual">("guided");
  const [rubric, setRubric] = useState<RubricSelection>(EMPTY_RUBRIC);
  const [rubricNotes, setRubricNotes] = useState("");
  const [collabIds, setCollabIds] = useState<number[]>([]);
  const [collabPick, setCollabPick] = useState<string>("");
  const taskSchema = useMemo(() => makeTaskSchema(t, mode), [t, mode]);

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "backlog",
      reason: "internal",
      ownerId: "",
      goalId: "",
      dueAt: "",
    },
  });

  const watchedOwnerId = form.watch("ownerId");
  const usersById = useMemo(
    () => new Map((users ?? []).map((u) => [u.id, u])),
    [users],
  );
  const collabNames = useMemo(
    () =>
      collabIds
        .map((id) => usersById.get(id)?.name)
        .filter((n): n is string => !!n),
    [collabIds, usersById],
  );
  const availableCollaborators = useMemo(() => {
    const ownerNum =
      isManager && watchedOwnerId && watchedOwnerId !== "none" && watchedOwnerId !== ""
        ? parseInt(watchedOwnerId)
        : currentUser?.id;
    return (users ?? []).filter(
      (u) => !collabIds.includes(u.id) && u.id !== ownerNum,
    );
  }, [users, collabIds, watchedOwnerId, isManager, currentUser]);

  const handleAddCollaborator = (value: string) => {
    const id = parseInt(value);
    if (!Number.isNaN(id) && !collabIds.includes(id)) {
      setCollabIds((prev) => [...prev, id]);
    }
    setCollabPick("");
  };

  const handleAiSuggest = () => {
    const title = form.getValues("title");
    if (!title || title.trim() === "") {
      toast.error(t("ai.triage.title.required"));
      return;
    }
    const description = form.getValues("description");
    triage.mutate(
      { data: { title, description: description || undefined, lang } },
      {
        onSuccess: (res) => {
          form.setValue("category", res.category, { shouldValidate: true });
          form.setValue("reason", res.reason, { shouldValidate: true });
          if (isManager && res.suggestedOwnerId != null) {
            form.setValue("ownerId", String(res.suggestedOwnerId), {
              shouldValidate: true,
            });
          }
          setRationale(res.rationale);
          toast.success(t("ai.triage.applied"));
        },
        onError: () => toast.error(t("ai.triage.error")),
      },
    );
  };

  const resetAll = () => {
    form.reset();
    setRationale(null);
    setRubric(EMPTY_RUBRIC);
    setRubricNotes("");
    setMode("guided");
    setCollabIds([]);
    setCollabPick("");
  };

  const onSubmit = (values: TaskForm) => {
    if (!currentUser) return;

    const guidedTitle = assembleTitle(t, lang, rubric);
    const guidedDescription = assembleDescription(t, rubric, collabNames, rubricNotes);
    const title = mode === "guided" && guidedTitle ? guidedTitle : values.title;
    if (!title.trim()) {
      toast.error(t("validation.titleRequired"));
      return;
    }
    const description =
      mode === "guided"
        ? guidedDescription || undefined
        : values.description || undefined;

    createTask.mutate(
      {
        data: {
          title,
          description,
          category: values.category as any,
          reason: values.reason as any,
          ownerId: isManager
            ? (values.ownerId && values.ownerId !== "none" ? parseInt(values.ownerId) : undefined)
            : currentUser.id,
          goalId: values.goalId && values.goalId !== "none" ? parseInt(values.goalId) : undefined,
          createdById: currentUser.id,
          dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
          collaboratorIds: collabIds.length > 0 ? collabIds : undefined,
          ...(mode === "guided"
            ? {
                positionLevel: rubric.positionLevel ?? undefined,
                actionVerb: rubric.actionVerb ?? undefined,
                qualityStandard: rubric.qualityStandard ?? undefined,
                natureOfWork: rubric.natureOfWork ?? undefined,
                businessUnit: rubric.businessUnit ?? undefined,
                deliverable: rubric.deliverable ?? undefined,
              }
            : {}),
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDigestQueryKey() });
          toast.success(t("createTask.toast.created"));
          setOpen(false);
          resetAll();
        }
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-sm font-semibold tracking-wide">
          <Plus className="w-4 h-4" />
          {t("createTask.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl glass-card border-none shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-serif tracking-tight">{t("createTask.title")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => setMode("guided")}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === "guided" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {t("rubric.guided")}
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === "manual" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {t("rubric.manual")}
              </button>
            </div>

            {mode === "guided" ? (
              <>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("rubric.guidedHint")}</p>
                <TaskRubricFields
                  selection={rubric}
                  onChange={setRubric}
                  notes={rubricNotes}
                  onNotesChange={setRubricNotes}
                  memberNames={collabNames}
                />
              </>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createTask.field.title")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("createTask.field.title.placeholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAiSuggest}
                  disabled={triage.isPending}
                  className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10 font-semibold tracking-wide"
                >
                  {triage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {triage.isPending ? t("ai.triage.suggesting") : t("ai.triage.suggest")}
                </Button>

                {rationale && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t("ai.triage.rationale")}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{rationale}</p>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("createTask.field.category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("createTask.field.category.placeholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="urgent">{t("category.urgent")}</SelectItem>
                        <SelectItem value="backlog">{t("category.backlog")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("createTask.field.reason")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("createTask.field.reason.placeholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="partner">{t("reason.partner")}</SelectItem>
                        <SelectItem value="compliance">{t("reason.compliance")}</SelectItem>
                        <SelectItem value="manager">{t("reason.manager")}</SelectItem>
                        <SelectItem value="client">{t("reason.client")}</SelectItem>
                        <SelectItem value="internal">{t("reason.internal")}</SelectItem>
                        <SelectItem value="finance">{t("reason.finance")}</SelectItem>
                        <SelectItem value="other">{t("reason.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {!isManager && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-muted-foreground">
                {t("createTask.selfAssignNote")}
              </div>
            )}

            <div className={isManager ? "grid grid-cols-2 gap-4" : ""}>
              {isManager && (
                <FormField
                  control={form.control}
                  name="ownerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("createTask.field.assign")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("common.unassigned")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                          {users?.map(u => (
                            <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="goalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("createTask.field.goal")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("task.noGoal")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("task.noGoal")}</SelectItem>
                        {goals?.map(g => (
                          <SelectItem key={g.id} value={g.id.toString()}>{g.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {t("collab.title")}
              </label>
              {collabIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {collabIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2 py-0.5 text-xs font-medium border border-border/50 bg-background/60"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 ring-black/10"
                        style={userColor(id)}
                      >
                        {usersById.get(id)?.name?.charAt(0).toUpperCase() ?? "?"}
                      </span>
                      {usersById.get(id)?.name ?? `#${id}`}
                      <button
                        type="button"
                        onClick={() => setCollabIds((prev) => prev.filter((x) => x !== id))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={t("collab.remove")}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {availableCollaborators.length > 0 && (
                <Select value={collabPick} onValueChange={handleAddCollaborator}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("collab.placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCollaborators.map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <FormField
              control={form.control}
              name="dueAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("createTask.field.due")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "manual" && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("createTask.field.description")}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t("createTask.field.description.placeholder")} className="resize-none h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={createTask.isPending}>{t("createTask.submit")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
