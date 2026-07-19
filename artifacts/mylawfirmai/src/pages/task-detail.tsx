import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { 
  useGetTask, 
  useListTaskNotes, 
  useAddTaskNote, 
  useAcknowledgeTask,
  useChangeTaskStatus,
  useUpdateTask,
  useNudgeTask,
  useListUsers,
  useListGoals,
  useListTaskAttempts,
  useAddTaskAttempt,
  useListTaskEvidence,
  useAddTaskEvidence,
  useDeleteTaskEvidence,
  useArchiveTask,
  useListTaskActivity,
  getGetTaskQueryKey,
  getListTaskNotesQueryKey,
  getListUsersQueryKey,
  getListGoalsQueryKey,
  getListTaskAttemptsQueryKey,
  getListTaskEvidenceQueryKey,
  getListTaskActivityQueryKey,
  getListTasksQueryKey
} from "@/lib/api-client";
import type { TaskActivity } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@workspace/object-storage-web";
import { useRecorder, formatElapsed } from "@/hooks/useRecorder";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, MessageSquare, AlertCircle, Play, CheckCircle2, AlertOctagon, Tag, User as UserIcon, Target, Mic, Square, Footprints, Paperclip, FileText, Trash2, Upload, Loader2, RotateCcw, Archive, History } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { AssessmentWidget } from "@/components/AssessmentWidget";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { CollaboratorManager } from "@/components/CollaboratorManager";
import { useT, useLabels, useFormatDate } from "@/lib/i18n";
import { useDescribeActivity } from "@/lib/describeActivity";
import { activityCategories } from "@/lib/activityCategories";
import { userColor } from "@/lib/userColor";

export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = id ? parseInt(id, 10) : 0;
  const t = useT();
  const labels = useLabels();
  const formatDate = useFormatDate();
  const { currentUser, isManager } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [newAttempt, setNewAttempt] = useState("");
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");

  const { data: task, isLoading: taskLoading } = useGetTask(taskId, {
    query: { enabled: !!taskId, queryKey: getGetTaskQueryKey(taskId) },
  });
  const { data: notes, isLoading: notesLoading } = useListTaskNotes(taskId, {
    query: { enabled: !!taskId, queryKey: getListTaskNotesQueryKey(taskId) },
  });
  const { data: attempts, isLoading: attemptsLoading } = useListTaskAttempts(taskId, {
    query: { enabled: !!taskId, queryKey: getListTaskAttemptsQueryKey(taskId) },
  });
  const { data: evidence, isLoading: evidenceLoading } = useListTaskEvidence(taskId, {
    query: {
      enabled: !!taskId && !!currentUser,
      queryKey: getListTaskEvidenceQueryKey(taskId),
      queryFn: async ({ signal }) => {
        const res = await fetch(
          `/api/tasks/${taskId}/evidence`,
          { signal, credentials: "include" }
        );
        if (!res.ok) throw new Error("Failed to load evidence");
        return res.json();
      },
    },
  });
  const { data: activity, isLoading: activityLoading } = useListTaskActivity(taskId, {
    query: { enabled: !!taskId, queryKey: getListTaskActivityQueryKey(taskId) },
  });
  const { data: users } = useListUsers({
    query: { enabled: !!currentUser, queryKey: getListUsersQueryKey() },
  });
  const { data: goals } = useListGoals(undefined, {
    query: { enabled: !!currentUser, queryKey: getListGoalsQueryKey() },
  });

  const addNote = useAddTaskNote();
  const acknowledge = useAcknowledgeTask();
  const changeStatus = useChangeTaskStatus();
  const updateTask = useUpdateTask();
  const nudge = useNudgeTask();
  const addAttempt = useAddTaskAttempt();
  const addEvidence = useAddTaskEvidence();
  const deleteEvidence = useDeleteTaskEvidence();
  const archiveTask = useArchiveTask();
  const recorder = useRecorder();
  const { uploadFile, isUploading } = useUpload({
    actingUserId: currentUser?.id,
    
    onError: () => toast.error(t("task.evidenceFailed")),
  });

  const isOwner = currentUser?.id === task?.ownerId;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getListTaskNotesQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getListTaskActivityQueryKey(taskId) });
  };

  const invalidateAttempts = () => {
    queryClient.invalidateQueries({ queryKey: getListTaskAttemptsQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
  };

  const invalidateEvidence = () => {
    queryClient.invalidateQueries({ queryKey: getListTaskEvidenceQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
  };

  const handleLogAttempt = () => {
    if (!currentUser || !newAttempt.trim()) return;
    addAttempt.mutate(
      { id: taskId, data: { body: newAttempt, authorId: currentUser.id } },
      {
        onSuccess: () => { setNewAttempt(""); invalidateAttempts(); toast.success(t("task.attemptLogged")); },
        onError: () => toast.error(t("task.attemptFailed")),
      }
    );
  };

  const handleSubmitRecording = () => {
    if (!currentUser || !recorder.result) return;
    addAttempt.mutate(
      { id: taskId, data: { audioBase64: recorder.result.audioBase64, authorId: currentUser.id } },
      {
        onSuccess: () => { recorder.reset(); invalidateAttempts(); toast.success(t("task.attemptLogged")); },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : t("task.attemptFailed");
          toast.error(msg);
        },
      }
    );
  };

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentUser) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error(t("task.evidenceTooLarge"));
      return;
    }
    const uploaded = await uploadFile(file);
    if (!uploaded) return;
    addEvidence.mutate(
      {
        id: taskId,
        data: {
          objectPath: uploaded.objectPath,
          fileName: file.name,
          contentType: file.type || null,
          fileSize: file.size,
          authorId: currentUser.id,
        },
      },
      {
        onSuccess: () => { invalidateEvidence(); toast.success(t("task.evidenceAdded")); },
        onError: () => toast.error(t("task.evidenceFailed")),
      }
    );
  };

  const handleDeleteEvidence = (evidenceId: number) => {
    if (!currentUser) return;
    deleteEvidence.mutate(
      { id: taskId, evidenceId, data: { actingUserId: currentUser.id } },
      {
        onSuccess: () => { invalidateEvidence(); toast.success(t("task.evidenceDeleted")); },
        onError: () => toast.error(t("task.evidenceFailed")),
      }
    );
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleAddNote = () => {
    if (!currentUser || !newNote.trim()) return;
    addNote.mutate(
      { id: taskId, data: { body: newNote, authorId: currentUser.id } },
      { onSuccess: () => { setNewNote(""); invalidate(); toast.success(t("task.toast.note")); } }
    );
  };

  const handleAcknowledge = () => {
    if (!currentUser) return;
    acknowledge.mutate(
      { id: taskId, data: { actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.ack")); } }
    );
  };

  const handleStatusChange = (status: "in_progress" | "blocked" | "done") => {
    if (!currentUser) return;
    changeStatus.mutate(
      { id: taskId, data: { status, actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.status", { status: labels.status(status) })); } }
    );
  };

  const handleReassign = (ownerId: string) => {
    if (!currentUser) return;
    updateTask.mutate(
      { id: taskId, data: { ownerId: ownerId === "none" ? null : parseInt(ownerId), actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.reassigned")); } }
    );
  };

  const handleCategoryChange = (category: string) => {
    if (!currentUser) return;
    updateTask.mutate(
      { id: taskId, data: { category: category as any, actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.classification")); } }
    );
  };

  const handleReasonChange = (reason: string) => {
    if (!currentUser) return;
    updateTask.mutate(
      { id: taskId, data: { reason: reason as any, actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.reason")); } }
    );
  };

  const handleGoalChange = (goalId: string) => {
    if (!currentUser) return;
    updateTask.mutate(
      { id: taskId, data: { goalId: goalId === "none" ? null : parseInt(goalId), actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.goal")); } }
    );
  };

  const handleResetToTodo = (toastKey: string) => {
    if (!currentUser) return;
    updateTask.mutate(
      { id: taskId, data: { status: "todo", actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t(toastKey)); } }
    );
  };

  const handleClaim = () => {
    if (!currentUser) return;
    updateTask.mutate(
      { id: taskId, data: { ownerId: currentUser.id, actingUserId: currentUser.id } },
      { onSuccess: () => { invalidate(); toast.success(t("task.toast.claimed")); } }
    );
  };

  const handleArchive = () => {
    if (!currentUser) return;
    if (!confirm(t("task.confirmArchive"))) return;
    archiveTask.mutate(
      { id: taskId, data: { actingUserId: currentUser.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          toast.success(t("task.toast.archived"));
          navigate(task?.category === "urgent" ? "/urgent" : "/backlog");
        },
      }
    );
  };

  const describeActivity = useDescribeActivity();

  const presentCategories = activityCategories.filter((c) =>
    activity?.some((e) => c.actions.includes(e.action))
  );

  const presentActors = (() => {
    const seen = new Map<string, string>();
    for (const e of activity ?? []) {
      const id = e.actorId != null ? String(e.actorId) : "__system__";
      if (!seen.has(id)) seen.set(id, e.actorName || t("task.system"));
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  })();

  const filteredActivity = activity
    ?.filter((e) =>
      historyFilter === "all"
        ? true
        : activityCategories
            .find((c) => c.key === historyFilter)
            ?.actions.includes(e.action)
    )
    .filter((e) =>
      actorFilter === "all"
        ? true
        : (e.actorId != null ? String(e.actorId) : "__system__") === actorFilter
    );

  if (taskLoading) {
    return (
      <AppLayout>
        <div className="p-8 max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!task) {
    return (
      <AppLayout>
        <div className="p-8 max-w-4xl mx-auto text-center mt-24">
          <h2 className="text-2xl font-bold">{t("task.notFound")}</h2>
          <Button asChild variant="link" className="mt-4"><Link href="/urgent">{t("task.returnRadar")}</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const isUnacknowledgedUrgent = task.category === "urgent" && task.status === "todo";
  const canAcknowledge = isUnacknowledgedUrgent && (isOwner || isManager);

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <Button variant="ghost" asChild className="mb-8 -ml-4 text-muted-foreground font-medium hover:text-foreground hover:bg-muted/50">
          <Link href={task.category === "urgent" ? "/urgent" : "/backlog"}>
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("task.back", { category: labels.category(task.category) })}
          </Link>
        </Button>

        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 space-y-10">
            <header className="glass-card p-8 rounded-3xl border-border/40">
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                {isUnacknowledgedUrgent && <Badge variant="destructive" className="animate-pulse shadow-sm font-medium">{t("flag.unacknowledged")}</Badge>}
                {task.criticalFlag && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 font-medium">{t("flag.critical")}</Badge>}
                {task.staleFlag && <Badge variant="outline" className="bg-muted text-muted-foreground font-medium">{t("flag.stale")}</Badge>}
                <Badge variant={task.category === "urgent" ? "destructive" : "secondary"} className="shadow-sm font-medium">{labels.category(task.category)}</Badge>
                <Badge variant="outline" className="flex items-center gap-1.5 font-medium border-border/60 bg-background/50">
                  <Tag className="w-3 h-3 text-muted-foreground" /> {labels.reason(task.reason)}
                </Badge>
                <Badge variant="outline" className="font-medium border-border/60 bg-background/50">{labels.status(task.status)}</Badge>
                {task.goalTitle && (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5 font-medium shadow-sm">
                    <Target className="w-3 h-3" /> {task.goalTitle}
                  </Badge>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight leading-[1.15] text-foreground">{task.title}</h1>
              
              <div className="flex items-center gap-5 mt-8 text-sm text-muted-foreground border-t border-border/40 pt-6 font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ring-black/10" style={userColor(task.ownerId)}>
                    {task.ownerName ? task.ownerName.charAt(0).toUpperCase() : "?"}
                  </div>
                  <span className="text-foreground/80">{task.ownerName || t("common.unassigned")}</span>
                </div>
                <div className="flex items-center gap-2 text-foreground/70">
                  <Clock className="w-4 h-4" /> 
                  <span>{t("task.created", { date: formatDate(task.createdAt, "MMM d, yyyy") })}</span>
                </div>
                {task.dueAt && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <Clock className="w-4 h-4" /> 
                    <span className="font-semibold">{t("task.due", { date: formatDate(task.dueAt, "MMM d") })}</span>
                  </div>
                )}
              </div>
            </header>

            {task.description && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80 leading-relaxed font-medium bg-muted/20 p-8 rounded-3xl border border-border/40">
                <p className="whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            <div className="space-y-8 pt-8">
              <h3 className="text-2xl font-serif font-bold flex items-center gap-3">
                <MessageSquare className="w-6 h-6 text-primary" /> {t("task.activity")}
              </h3>
              
              <div className="space-y-6">
                <div className="flex gap-4 items-start glass-card p-6 rounded-3xl">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-1 ring-black/10 shadow-sm" style={userColor(currentUser?.id)}>
                    {currentUser?.name.charAt(0) || "?"}
                  </div>
                  <div className="flex-1 space-y-3">
                    <Textarea 
                      placeholder={t("task.notePlaceholder")} 
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      className="min-h-[120px] resize-none bg-background/50 border-border/50 focus-visible:ring-primary shadow-sm rounded-xl text-base"
                    />
                    <div className="flex justify-end">
                      <Button onClick={handleAddNote} disabled={addNote.isPending || !newNote.trim()} className="font-semibold px-6 shadow-sm rounded-lg">
                        {t("task.postNote")}
                      </Button>
                    </div>
                  </div>
                </div>

                {notesLoading ? (
                  <Skeleton className="h-32 w-full rounded-2xl" />
                ) : notes?.length === 0 ? (
                  <p className="text-center text-muted-foreground font-medium py-12 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">{t("task.noActivity")}</p>
                ) : (
                  <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[1.15rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-[3px] before:bg-gradient-to-b before:from-transparent before:via-border/40 before:to-transparent pt-4">
                    {notes?.map(note => (
                      <Card key={note.id} className="relative shadow-sm hover:shadow-md transition-shadow border-border/40 rounded-2xl overflow-hidden glass-card">
                        <div className="p-5">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-semibold text-foreground/90">{note.authorName || t("task.system")}</span>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">{formatDate(note.createdAt, "MMM d, h:mm a")}</span>
                          </div>
                          <p className="text-[15px] font-medium text-muted-foreground whitespace-pre-wrap leading-relaxed">{note.body}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8 pt-8">
              <div>
                <h3 className="text-2xl font-serif font-bold flex items-center gap-3">
                  <History className="w-6 h-6 text-primary" /> {t("activity.title")}
                </h3>
                <p className="text-sm text-muted-foreground font-medium mt-2">{t("activity.subtitle")}</p>
              </div>

              {activityLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : (activity?.length ?? 0) === 0 ? (
                <p className="text-center text-muted-foreground font-medium py-10 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">{t("activity.empty")}</p>
              ) : (
                <div className="space-y-4">
                  {presentCategories.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {[{ key: "all", actions: [] }, ...presentCategories].map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => setHistoryFilter(c.key)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                            historyFilter === c.key
                              ? "bg-primary text-primary-foreground ring-primary"
                              : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
                          }`}
                        >
                          {t(`activity.filter.${c.key}`)}
                        </button>
                      ))}
                    </div>
                  )}
                  {presentActors.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground mr-1">{t("activity.filterByActor")}</span>
                      <button
                        type="button"
                        onClick={() => setActorFilter("all")}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                          actorFilter === "all"
                            ? "bg-primary text-primary-foreground ring-primary"
                            : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
                        }`}
                      >
                        {t("activity.actor.all")}
                      </button>
                      {presentActors.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setActorFilter(a.id)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                            actorFilter === a.id
                              ? "bg-primary text-primary-foreground ring-primary"
                              : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
                          }`}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {(filteredActivity?.length ?? 0) === 0 ? (
                    <p className="text-center text-muted-foreground font-medium py-10 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">{t("activity.emptyFiltered")}</p>
                  ) : filteredActivity?.map(entry => (
                    <Card key={entry.id} className="shadow-sm border-border/40 rounded-2xl overflow-hidden glass-card">
                      <div className="p-5 flex items-start gap-4">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-black/10" style={userColor(entry.actorId ?? undefined)}>
                          {entry.actorName ? entry.actorName.charAt(0).toUpperCase() : "·"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-3 mb-1">
                            <span className="font-semibold text-foreground/90">{entry.actorName || t("task.system")}</span>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md shrink-0">{formatDate(entry.createdAt, "MMM d, h:mm a")}</span>
                          </div>
                          <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">{describeActivity(entry)}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-8 pt-8">
              <div>
                <h3 className="text-2xl font-serif font-bold flex items-center gap-3">
                  <Footprints className="w-6 h-6 text-primary" /> {t("task.attempts")}
                </h3>
                <p className="text-sm text-muted-foreground font-medium mt-2">{t("task.attemptsHint")}</p>
              </div>

              <div className="space-y-6">
                <div className="glass-card p-6 rounded-3xl space-y-4">
                  <Textarea
                    placeholder={t("task.attemptPlaceholder")}
                    value={newAttempt}
                    onChange={e => setNewAttempt(e.target.value)}
                    disabled={recorder.state !== "idle"}
                    className="min-h-[100px] resize-none bg-background/50 border-border/50 focus-visible:ring-primary shadow-sm rounded-xl text-base"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {recorder.state === "idle" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={recorder.start}
                          disabled={!recorder.supported || addAttempt.isPending}
                          className="font-semibold rounded-lg border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                        >
                          <Mic className="w-4 h-4 mr-2" /> {t("task.recordAttempt")}
                        </Button>
                      )}
                      {recorder.state === "recording" && (
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={recorder.stop}
                          className="font-semibold rounded-lg animate-pulse"
                        >
                          <Square className="w-4 h-4 mr-2" /> {t("task.stopRecording")} · {formatElapsed(recorder.elapsedMs)}
                        </Button>
                      )}
                      {recorder.state === "ready" && (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            onClick={handleSubmitRecording}
                            disabled={addAttempt.isPending}
                            className="font-semibold rounded-lg"
                          >
                            {addAttempt.isPending ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("task.transcribing")}</>
                            ) : (
                              <><Mic className="w-4 h-4 mr-2" /> {t("task.useRecording")}</>
                            )}
                          </Button>
                          <Button type="button" variant="ghost" onClick={recorder.reset} disabled={addAttempt.isPending} className="font-semibold rounded-lg">
                            {t("task.discardRecording")}
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleLogAttempt}
                      disabled={addAttempt.isPending || !newAttempt.trim() || recorder.state !== "idle"}
                      className="font-semibold px-6 shadow-sm rounded-lg"
                    >
                      {t("task.logAttempt")}
                    </Button>
                  </div>
                  {recorder.error === "unsupported" && (
                    <p className="text-sm font-medium text-destructive">{t("task.recorderUnsupported")}</p>
                  )}
                  {recorder.error === "denied" && (
                    <p className="text-sm font-medium text-destructive">{t("task.recorderDenied")}</p>
                  )}
                </div>

                {attemptsLoading ? (
                  <Skeleton className="h-24 w-full rounded-2xl" />
                ) : attempts?.length === 0 ? (
                  <p className="text-center text-muted-foreground font-medium py-10 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">{t("task.noAttempts")}</p>
                ) : (
                  <div className="space-y-4">
                    {attempts?.map(attempt => (
                      <Card key={attempt.id} className="shadow-sm border-border/40 rounded-2xl overflow-hidden glass-card">
                        <div className="p-5">
                          <div className="flex justify-between items-center mb-3 gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground/90">{attempt.authorName || t("task.system")}</span>
                              <Badge variant="secondary" className="font-semibold text-[10px] uppercase tracking-wide">
                                {attempt.source === "voice" ? (
                                  <><Mic className="w-3 h-3 mr-1" /> {t("task.attemptVoice")}</>
                                ) : (
                                  t("task.attemptText")
                                )}
                              </Badge>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md shrink-0">{formatDate(attempt.createdAt, "MMM d, h:mm a")}</span>
                          </div>
                          <p className="text-[15px] font-medium text-muted-foreground whitespace-pre-wrap leading-relaxed">{attempt.body}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8 pt-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-serif font-bold flex items-center gap-3">
                    <Paperclip className="w-6 h-6 text-primary" /> {t("task.evidence")}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium mt-2">{t("task.evidenceHint")}</p>
                </div>
                <label className="inline-flex">
                  <input type="file" className="hidden" onChange={handleUploadEvidence} disabled={isUploading || addEvidence.isPending} />
                  <span className={`inline-flex items-center gap-2 h-11 px-5 rounded-xl font-semibold text-sm cursor-pointer shadow-sm transition-colors ${isUploading || addEvidence.isPending ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                    {isUploading || addEvidence.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> {t("task.uploading")}</>
                    ) : (
                      <><Upload className="w-4 h-4" /> {t("task.uploadEvidence")}</>
                    )}
                  </span>
                </label>
              </div>

              {evidenceLoading ? (
                <Skeleton className="h-24 w-full rounded-2xl" />
              ) : evidence?.length === 0 ? (
                <p className="text-center text-muted-foreground font-medium py-10 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">{t("task.noEvidence")}</p>
              ) : (
                <div className="space-y-3">
                  {evidence?.map(file => (
                    <Card key={file.id} className="shadow-sm border-border/40 rounded-2xl overflow-hidden glass-card">
                      <div className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/20">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground/90 truncate">{file.fileName}</p>
                          <p className="text-xs font-medium text-muted-foreground">
                            {(file.authorName || t("task.system"))}
                            {file.fileSize ? ` · ${formatFileSize(file.fileSize)}` : ""}
                            {` · ${formatDate(file.createdAt, "MMM d, h:mm a")}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/api/storage${file.objectPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                          >
                            {t("task.viewEvidence")}
                          </a>
                          {(isOwner || isManager) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              onClick={() => handleDeleteEvidence(file.id)}
                              disabled={deleteEvidence.isPending}
                              aria-label={t("task.deleteEvidence")}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="lg:w-80 space-y-6">
            {task.status === "done" && <AssessmentWidget taskId={taskId} />}
            <div className="glass-card border border-border/40 rounded-3xl p-6 space-y-5 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("task.actions")}</h3>
              
              <div className="flex flex-col gap-3">
                {canAcknowledge && (
                  <Button variant="destructive" className="w-full justify-start font-semibold rounded-xl h-11" onClick={handleAcknowledge}>
                    <AlertCircle className="w-5 h-5 mr-2.5" /> {t("task.acknowledge")}
                  </Button>
                )}
                
                {task.status !== "done" && (isOwner || isManager) && (
                  <>
                    {task.status !== "in_progress" && task.status !== "todo" && (
                      <Button variant="outline" className="w-full justify-start text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 font-semibold rounded-xl h-11" onClick={() => handleStatusChange("in_progress")}>
                        <Play className="w-5 h-5 mr-2.5" /> {t("task.startProgress")}
                      </Button>
                    )}
                    {task.status !== "blocked" && (
                      <Button variant="outline" className="w-full justify-start text-orange-600 border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 font-semibold rounded-xl h-11" onClick={() => handleStatusChange("blocked")}>
                        <AlertOctagon className="w-5 h-5 mr-2.5" /> {t("task.markBlocked")}
                      </Button>
                    )}
                    <Button variant="outline" className="w-full justify-start text-green-600 border-green-600/20 bg-green-600/5 hover:bg-green-600/10 font-semibold rounded-xl h-11" onClick={() => handleStatusChange("done")}>
                      <CheckCircle2 className="w-5 h-5 mr-2.5" /> {t("task.markDone")}
                    </Button>
                  </>
                )}

                {isManager && !isOwner && task.ownerId && task.status !== "done" && (
                  <Button variant="secondary" className="w-full justify-start font-semibold rounded-xl h-11 border border-border/50" onClick={() => nudge.mutate({ id: taskId, data: { actingUserId: currentUser?.id } }, { onSuccess: () => toast.success(t("task.toast.nudged")) })}>
                    <UserIcon className="w-5 h-5 mr-2.5" /> {t("task.nudgeOwner")}
                  </Button>
                )}

                {isManager && (
                  <>
                    {task.status === "done" && (
                      <Button variant="outline" className="w-full justify-start text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 font-semibold rounded-xl h-11" onClick={() => handleResetToTodo("task.toast.reopened")} disabled={updateTask.isPending}>
                        <RotateCcw className="w-5 h-5 mr-2.5" /> {t("task.reopen")}
                      </Button>
                    )}
                    {task.status !== "todo" && task.status !== "done" && (
                      <Button variant="outline" className="w-full justify-start font-semibold rounded-xl h-11 border border-border/50" onClick={() => handleResetToTodo("task.toast.resetTodo")} disabled={updateTask.isPending}>
                        <RotateCcw className="w-5 h-5 mr-2.5" /> {t("task.resetTodo")}
                      </Button>
                    )}
                    {!isOwner && (
                      <Button variant="outline" className="w-full justify-start font-semibold rounded-xl h-11 border border-border/50" onClick={handleClaim} disabled={updateTask.isPending}>
                        <UserIcon className="w-5 h-5 mr-2.5" /> {t("task.claim")}
                      </Button>
                    )}
                  </>
                )}

                {currentUser && (
                  <>
                    <EditTaskDialog task={task} />
                    <Button variant="outline" className="w-full justify-start text-destructive border-destructive/20 bg-destructive/5 hover:bg-destructive/10 font-semibold rounded-xl h-11" onClick={handleArchive} disabled={archiveTask.isPending}>
                      <Archive className="w-5 h-5 mr-2.5" /> {t("task.archive")}
                    </Button>
                  </>
                )}
              </div>
            </div>

            {currentUser && <CollaboratorManager taskId={taskId} ownerId={task.ownerId} />}

            {currentUser && (
              <div className="glass-card border border-border/40 rounded-3xl p-6 space-y-6 shadow-sm">
                <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground">{t("task.management")}</h3>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">{t("task.classification")}</label>
                    <Select value={task.category} onValueChange={handleCategoryChange}>
                      <SelectTrigger className="w-full bg-background/50 rounded-xl h-11 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-medium">
                        <SelectItem value="urgent">{t("category.urgent")}</SelectItem>
                        <SelectItem value="backlog">{t("category.backlog")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground/80 leading-snug">{t("task.classification.hint")}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">{t("task.assignee")}</label>
                    <Select value={task.ownerId?.toString() || "none"} onValueChange={handleReassign}>
                      <SelectTrigger className="w-full bg-background/50 rounded-xl h-11 font-medium">
                        <SelectValue placeholder={t("common.unassigned")} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-medium">
                        <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                        {users?.map(u => (
                          <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">{t("task.priorityReason")}</label>
                    <Select value={task.reason} onValueChange={handleReasonChange}>
                      <SelectTrigger className="w-full bg-background/50 rounded-xl h-11 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-medium">
                        <SelectItem value="partner">{t("reason.partner")}</SelectItem>
                        <SelectItem value="compliance">{t("reason.compliance")}</SelectItem>
                        <SelectItem value="manager">{t("reason.manager")}</SelectItem>
                        <SelectItem value="client">{t("reason.client")}</SelectItem>
                        <SelectItem value="internal">{t("reason.internal")}</SelectItem>
                        <SelectItem value="finance">{t("reason.finance")}</SelectItem>
                        <SelectItem value="other">{t("reason.other")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">{t("task.relatedGoal")}</label>
                    <Select value={task.goalId?.toString() || "none"} onValueChange={handleGoalChange}>
                      <SelectTrigger className="w-full bg-background/50 rounded-xl h-11 font-medium">
                        <SelectValue placeholder={t("task.noGoal")} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl font-medium">
                        <SelectItem value="none">{t("task.noGoal")}</SelectItem>
                        {goals?.map(g => (
                          <SelectItem key={g.id} value={g.id.toString()}>{g.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
