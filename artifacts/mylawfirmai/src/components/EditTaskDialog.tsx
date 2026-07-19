import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth";
import {
  useUpdateTask,
  useListUsers,
  useListGoals,
  getGetTaskQueryKey,
  getListTasksQueryKey,
  getListTaskActivityQueryKey,
  getListUsersQueryKey,
  getListGoalsQueryKey,
  type Task,
} from "@/lib/api-client";
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
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useT, useLanguage, type TFunc } from "@/lib/i18n";
import { TaskRubricFields } from "@/components/TaskRubricFields";
import { CollaboratorManager } from "@/components/CollaboratorManager";
import { assembleTitle, assembleDescription, type RubricSelection } from "@/lib/taskRubric";

const makeEditSchema = (t: TFunc) =>
  z.object({
    title: z.string().min(1, t("validation.titleRequired")),
    description: z.string().optional(),
    category: z.enum(["urgent", "backlog"]),
    reason: z.enum(["partner", "compliance", "manager", "client", "internal", "finance", "other"]),
    ownerId: z.string().optional(),
    goalId: z.string().optional(),
    dueAt: z.string().optional(),
  });

type EditForm = z.infer<ReturnType<typeof makeEditSchema>>;

const EMPTY_RUBRIC: RubricSelection = {
  positionLevel: null,
  actionVerb: null,
  qualityStandard: null,
  natureOfWork: null,
  businessUnit: null,
  deliverable: null,
};

export function EditTaskDialog({
  task,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  task: Task;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) controlledOnOpenChange?.(next);
    else setUncontrolledOpen(next);
  };
  const t = useT();
  const { lang } = useLanguage();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const updateTask = useUpdateTask();
  const [mode, setMode] = useState<"guided" | "manual">("manual");
  const [rubric, setRubric] = useState<RubricSelection>(EMPTY_RUBRIC);
  const [rubricNotes, setRubricNotes] = useState("");

  const { data: users } = useListUsers({
    query: { enabled: open, queryKey: getListUsersQueryKey() },
  });
  const { data: goals } = useListGoals(undefined, {
    query: { enabled: open, queryKey: getListGoalsQueryKey() },
  });

  const editSchema = useMemo(() => makeEditSchema(t), [t]);

  const memberNames = useMemo(
    () =>
      (task.collaborators ?? [])
        .map((c) => c.name)
        .filter((n): n is string => !!n),
    [task.collaborators],
  );

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      reason: task.reason,
      ownerId: task.ownerId ? String(task.ownerId) : "none",
      goalId: task.goalId ? String(task.goalId) : "none",
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : "",
    },
  });

  // Re-sync from the latest task whenever the dialog opens — works for both
  // the uncontrolled trigger path and the controlled (TaskCard menu) path,
  // since onOpenChange does not fire when a parent flips `open` to true.
  useEffect(() => {
    if (!open) return;
    form.reset({
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      reason: task.reason,
      ownerId: task.ownerId ? String(task.ownerId) : "none",
      goalId: task.goalId ? String(task.goalId) : "none",
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : "",
    });
    setMode("manual");
    setRubric(EMPTY_RUBRIC);
    setRubricNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task.id]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
  };

  const onSubmit = (values: EditForm) => {
    if (!currentUser) return;
    const guidedTitle = assembleTitle(t, lang, rubric);
    const guidedDescription = assembleDescription(t, rubric, memberNames, rubricNotes);
    const useGuided = mode === "guided" && !!guidedTitle;
    const title = useGuided ? guidedTitle : values.title;
    if (!title.trim()) {
      toast.error(t("validation.titleRequired"));
      return;
    }
    const description = useGuided
      ? guidedDescription || null
      : values.description?.trim()
        ? values.description
        : null;

    updateTask.mutate(
      {
        id: task.id,
        data: {
          title,
          description,
          category: values.category,
          reason: values.reason,
          ownerId: values.ownerId && values.ownerId !== "none" ? parseInt(values.ownerId) : null,
          goalId: values.goalId && values.goalId !== "none" ? parseInt(values.goalId) : null,
          dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
          actingUserId: currentUser.id,
          ...(useGuided
            ? {
                positionLevel: rubric.positionLevel ?? undefined,
                actionVerb: rubric.actionVerb ?? undefined,
                qualityStandard: rubric.qualityStandard ?? undefined,
                natureOfWork: rubric.natureOfWork ?? undefined,
                businessUnit: rubric.businessUnit ?? undefined,
                deliverable: rubric.deliverable ?? undefined,
              }
            : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTaskActivityQueryKey(task.id) });
          toast.success(t("editTask.toast.updated"));
          setOpen(false);
        },
        onError: () => toast.error(t("editTask.toast.error")),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full justify-start font-semibold rounded-xl h-11 border border-border/50">
            <Pencil className="w-5 h-5 mr-2.5" /> {t("editTask.trigger")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl glass-card border-none shadow-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-serif tracking-tight">{t("editTask.title")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === "manual" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {t("rubric.manual")}
              </button>
              <button
                type="button"
                onClick={() => setMode("guided")}
                className={`px-3 py-1.5 rounded-md transition-colors ${mode === "guided" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                {t("rubric.guided")}
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
                  memberNames={memberNames}
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
                          <SelectValue />
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
                          <SelectValue />
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

            <div className="grid grid-cols-2 gap-4">
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
                        {users?.map((u) => (
                          <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        {goals?.map((g) => (
                          <SelectItem key={g.id} value={g.id.toString()}>{g.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

            <CollaboratorManager taskId={task.id} ownerId={task.ownerId} />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button type="submit" disabled={updateTask.isPending}>{t("editTask.submit")}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
