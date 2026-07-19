import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useAcknowledgeTask, useChangeTaskStatus, useNudgeTask, useArchiveTask, useAddTaskNote, useAddTaskAttempt, useAddTaskEvidence, useUpdateTask, useListUsers, getListUsersQueryKey, getListTaskNotesQueryKey, getListTaskAttemptsQueryKey, getListTaskEvidenceQueryKey, getListTaskActivityQueryKey, Task, getListTasksQueryKey, getGetDashboardQueryKey, getGetDigestQueryKey, getGetTaskQueryKey } from "@/lib/api-client";
import { useUpload } from "@workspace/object-storage-web";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, Play, AlertOctagon, CheckCircle2, MessageSquare, Hand, MoveRight, Tag, Target, Pencil, Archive, StickyNote, ClipboardList, Upload, Users, UserCog, Check, Sparkles } from "lucide-react";
import { EditTaskDialog } from "@/components/EditTaskDialog";
import { CollaboratorManager } from "@/components/CollaboratorManager";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useT, useLabels, useFormatDate } from "@/lib/i18n";
import { userColor, userCardTint } from "@/lib/userColor";

export function TaskCard({ task }: { task: Task }) {
  const { currentUser, isManager } = useAuth();
  const t = useT();
  const labels = useLabels();
  const formatDate = useFormatDate();
  const queryClient = useQueryClient();
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"blocked" | "done" | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [attemptOpen, setAttemptOpen] = useState(false);
  const [attemptBody, setAttemptBody] = useState("");
  const [collabOpen, setCollabOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffOwner, setHandoffOwner] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [animatingAction, setAnimatingAction] = useState<string | null>(null);
  const animTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (animTimeout.current) clearTimeout(animTimeout.current); }, []);

  const acknowledge = useAcknowledgeTask();
  const changeStatus = useChangeTaskStatus();
  const nudge = useNudgeTask();
  const archiveTask = useArchiveTask();
  const addNote = useAddTaskNote();
  const addAttempt = useAddTaskAttempt();
  const addEvidence = useAddTaskEvidence();
  const updateTask = useUpdateTask();
  const { data: users } = useListUsers({
    query: { enabled: !!currentUser, queryKey: getListUsersQueryKey() },
  });
  const { uploadFile } = useUpload({
    actingUserId: currentUser?.id,
    
    onError: () => toast.error(t("task.evidenceFailed")),
  });

  const isOwner = currentUser?.id === task.ownerId;
  const canAcknowledge = task.status === "todo" && task.category === "urgent" && (isOwner || isManager);
  const canAcknowledgeAny = !!currentUser && !canAcknowledge && task.status !== "done" && !task.acknowledgedAt;

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDigestQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) });
    queryClient.invalidateQueries({ queryKey: getListTaskNotesQueryKey(task.id) });
    queryClient.invalidateQueries({ queryKey: getListTaskAttemptsQueryKey(task.id) });
    queryClient.invalidateQueries({ queryKey: getListTaskEvidenceQueryKey(task.id) });
    queryClient.invalidateQueries({ queryKey: getListTaskActivityQueryKey(task.id) });
  };

  const handleAcknowledge = () => {
    if (!currentUser) return;
    setAnimatingAction("ack");
    animTimeout.current = setTimeout(() => {
      acknowledge.mutate(
        { id: task.id, data: { actingUserId: currentUser.id } },
        {
          onSuccess: () => { invalidateQueries(); toast.success(t("card.toast.ack")); },
          onSettled: () => setAnimatingAction(null),
        }
      );
    }, 400); // Give time for micro-interaction
  };

  const handleStart = () => {
    if (!currentUser) return;
    changeStatus.mutate(
      { id: task.id, data: { status: "in_progress", actingUserId: currentUser.id } },
      { onSuccess: () => { invalidateQueries(); toast.success(t("card.toast.started")); } }
    );
  };

  const handleUnblock = () => {
    if (!currentUser) return;
    const nextStatus = task.category === "urgent" ? "acknowledged" : "in_progress";
    changeStatus.mutate(
      { id: task.id, data: { status: nextStatus as any, actingUserId: currentUser.id } },
      { onSuccess: () => { invalidateQueries(); toast.success(t("card.toast.unblocked")); } }
    );
  };

  const handleNudge = () => {
    if (!currentUser) return;
    nudge.mutate(
      { id: task.id, data: { actingUserId: currentUser.id } },
      { onSuccess: () => { invalidateQueries(); toast.success(t("card.toast.nudged")); } }
    );
  };

  const handleArchive = () => {
    if (!currentUser) return;
    archiveTask.mutate(
      { id: task.id, data: { actingUserId: currentUser.id } },
      { onSuccess: () => { invalidateQueries(); toast.success(t("task.toast.archived")); } }
    );
  };

  const handleQuickNote = () => {
    if (!currentUser || !quickNote.trim()) return;
    addNote.mutate(
      { id: task.id, data: { body: quickNote, authorId: currentUser.id } },
      { onSuccess: () => { invalidateQueries(); toast.success(t("task.toast.note")); setQuickNote(""); setQuickNoteOpen(false); } }
    );
  };

  const handleQuickAttempt = () => {
    if (!currentUser || !attemptBody.trim()) return;
    addAttempt.mutate(
      { id: task.id, data: { body: attemptBody, authorId: currentUser.id } },
      {
        onSuccess: () => { invalidateQueries(); toast.success(t("task.attemptLogged")); setAttemptBody(""); setAttemptOpen(false); },
        onError: () => toast.error(t("task.attemptFailed")),
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
        id: task.id,
        data: {
          objectPath: uploaded.objectPath,
          fileName: file.name,
          contentType: file.type || null,
          fileSize: file.size,
          authorId: currentUser.id,
        },
      },
      {
        onSuccess: () => { invalidateQueries(); toast.success(t("task.evidenceAdded")); },
        onError: () => toast.error(t("task.evidenceFailed")),
      }
    );
  };

  const handleHandoff = () => {
    if (!currentUser || !handoffOwner) return;
    updateTask.mutate(
      { id: task.id, data: { ownerId: parseInt(handoffOwner), actingUserId: currentUser.id } },
      {
        onSuccess: () => { invalidateQueries(); toast.success(t("card.toast.handedOff")); setHandoffOwner(""); setHandoffOpen(false); },
        onError: () => toast.error(t("task.updateFailed")),
      }
    );
  };

  const submitStatusChangeWithNote = () => {
    if (!currentUser || !pendingStatus) return;
    if (pendingStatus === "done") {
      setAnimatingAction("done");
      animTimeout.current = setTimeout(() => {
        changeStatus.mutate(
          { id: task.id, data: { status: pendingStatus, note: noteBody, actingUserId: currentUser.id } },
          { onSuccess: () => { 
            invalidateQueries(); 
            toast.success(t("card.toast.marked", { status: labels.status(pendingStatus) })); 
            setNoteDialogOpen(false); 
            setNoteBody("");
            setPendingStatus(null);
          },
          onError: () => toast.error(t("task.updateFailed")),
          onSettled: () => setAnimatingAction(null),
          }
        );
      }, 500);
    } else {
      changeStatus.mutate(
        { id: task.id, data: { status: pendingStatus, note: noteBody, actingUserId: currentUser.id } },
        { onSuccess: () => { 
          invalidateQueries(); 
          toast.success(t("card.toast.marked", { status: labels.status(pendingStatus) })); 
          setNoteDialogOpen(false); 
          setNoteBody("");
          setPendingStatus(null);
        }}
      );
    }
  };

  const isUnacknowledgedUrgent = task.category === "urgent" && task.status === "todo";
  const tint = userCardTint(task.ownerId);

  return (
    <>
      <Card
        className={`relative overflow-hidden border-2 shadow-sm transition-all duration-300 ${
          isUnacknowledgedUrgent ? "ring-2 ring-destructive shadow-[0_0_15px_rgba(239,68,68,0.3)] border-destructive/50" :
          task.criticalFlag ? "ring-2 ring-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]" :
          task.staleFlag ? "opacity-80 grayscale-[20%]" : 
          "hover:shadow-lg hover:-translate-y-1 hover:border-primary/40 group"
        } ${animatingAction === "ack" ? "scale-95 opacity-50 blur-sm" : ""} ${animatingAction === "done" ? "scale-105 opacity-0 blur-md brightness-150 rotate-2" : ""}`}
        style={{ background: isUnacknowledgedUrgent ? `linear-gradient(to bottom right, ${tint.background}, rgba(239,68,68,0.05))` : tint.background, borderColor: isUnacknowledgedUrgent ? 'hsl(var(--destructive)/0.5)' : tint.borderColor }}
      >
        <div
          className={`absolute inset-x-0 top-0 h-1.5 transition-all duration-300 ${isUnacknowledgedUrgent ? 'animate-pulse' : 'group-hover:h-2'}`}
          style={{ backgroundColor: isUnacknowledgedUrgent ? 'hsl(var(--destructive))' : tint.accent }}
          aria-hidden="true"
          title={task.ownerName || t("common.unassigned")}
        />
        <CardHeader className="pb-3 pt-5 flex flex-row items-start justify-between gap-4 relative z-10">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {isUnacknowledgedUrgent && (
                <Badge variant="destructive" className="animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)] font-bold tracking-wider">{t("flag.unacknowledged")}</Badge>
              )}
              {task.criticalFlag && (
                <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 font-bold uppercase tracking-wider">{t("flag.critical")}</Badge>
              )}
              {task.staleFlag && (
                <Badge variant="outline" className="bg-muted text-muted-foreground font-bold uppercase tracking-wider">{t("flag.stale")}</Badge>
              )}
              <Badge variant={task.category === "urgent" ? "destructive" : "secondary"} className="shadow-sm font-bold uppercase tracking-wider">
                {labels.category(task.category)}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1.5 font-bold uppercase tracking-wider border-border/60 bg-background/50">
                <Tag className="w-3 h-3 text-muted-foreground" />
                {labels.reason(task.reason)}
              </Badge>
              <Badge variant="outline" className="font-bold uppercase tracking-wider border-border/60 bg-background/50">
                {labels.status(task.status)}
              </Badge>
              {task.goalTitle && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1.5 font-bold uppercase tracking-wider shadow-sm">
                  <Target className="w-3 h-3" />
                  {task.goalTitle}
                </Badge>
              )}
              {task.priorityScore > 0 && (
                <span className="text-xs font-serif font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 shadow-sm flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {task.priorityScore} {t("game.xp")}
                </span>
              )}
            </div>
            <h3 className="font-serif font-bold text-xl leading-snug">
              <Link href={`/task/${task.id}`} className="hover:text-primary transition-colors duration-200 drop-shadow-sm">
                {task.title}
              </Link>
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3 font-semibold">
              <span className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ring-2 ring-background shadow-sm" style={userColor(task.ownerId)}>
                  {task.ownerName ? task.ownerName.charAt(0).toUpperCase() : "?"}
                </div>
                <span className="text-foreground/80">{task.ownerName || t("common.unassigned")}</span>
              </span>
              {task.dueAt && (
                <span className="flex items-center gap-1.5 text-foreground/80 bg-background/50 px-2 py-0.5 rounded-md border border-border/40 shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {formatDate(task.dueAt, "MMM d")}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-foreground/70">
                <MessageSquare className="w-3.5 h-3.5 text-accent" />
                {task.noteCount}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 relative z-20">
            {canAcknowledge && (
              <Button size="sm" variant="destructive" className="font-bold tracking-wider uppercase shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse hover:animate-none hover:scale-105 transition-transform" onClick={handleAcknowledge} disabled={acknowledge.isPending}>
                <AlertCircle className="w-4 h-4 mr-2" />
                {t("task.acknowledge")}
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary hover:text-primary-foreground transition-colors rounded-full">
                  <span className="sr-only">{t("card.openMenu")}</span>
                  <div className="flex flex-col gap-1 items-center">
                    <span className="w-1 h-1 rounded-full bg-current" />
                    <span className="w-1 h-1 rounded-full bg-current" />
                    <span className="w-1 h-1 rounded-full bg-current" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-medium">
                {canAcknowledgeAny && (
                  <DropdownMenuItem onClick={handleAcknowledge} className="font-bold text-primary focus:text-primary focus:bg-primary/10">
                    <Check className="w-4 h-4 mr-2 stroke-[3]" /> {t("task.acknowledge")}
                  </DropdownMenuItem>
                )}
                {task.status !== "done" && (isOwner || isManager) && (
                  <>
                    {(task.status === "acknowledged" || (task.category === "backlog" && task.status === "todo")) && (
                      <DropdownMenuItem onClick={handleStart} className="font-bold text-accent focus:text-accent focus:bg-accent/10">
                        <Play className="w-4 h-4 mr-2 stroke-[3]" /> {t("task.startProgress")}
                      </DropdownMenuItem>
                    )}
                    {task.status === "blocked" ? (
                      <DropdownMenuItem onClick={handleUnblock} className="font-bold text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10">
                        <AlertOctagon className="w-4 h-4 mr-2 stroke-[3]" /> {t("card.unblock")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => { setPendingStatus("blocked"); setNoteDialogOpen(true); }} className="font-bold text-orange-500 focus:text-orange-500 focus:bg-orange-500/10">
                        <AlertOctagon className="w-4 h-4 mr-2 stroke-[3]" /> {t("card.markBlockedMenu")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => { setPendingStatus("done"); setNoteDialogOpen(true); }} className="font-bold text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10">
                      <CheckCircle2 className="w-4 h-4 mr-2 stroke-[3]" /> {t("card.markDoneMenu")}
                    </DropdownMenuItem>
                  </>
                )}

                {currentUser && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setQuickNoteOpen(true); }}>
                      <StickyNote className="w-4 h-4 mr-2 text-muted-foreground" /> {t("card.action.addNote")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setAttemptOpen(true); }}>
                      <ClipboardList className="w-4 h-4 mr-2 text-muted-foreground" /> {t("card.action.logAttempt")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}>
                      <Upload className="w-4 h-4 mr-2 text-muted-foreground" /> {t("card.action.uploadEvidence")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setCollabOpen(true); }}>
                      <Users className="w-4 h-4 mr-2 text-muted-foreground" /> {t("card.action.addCollaborator")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setHandoffOwner(task.ownerId?.toString() ?? ""); setHandoffOpen(true); }}>
                      <UserCog className="w-4 h-4 mr-2 text-muted-foreground" /> {t("card.action.handoff")}
                    </DropdownMenuItem>
                  </>
                )}

                {isManager && task.ownerId !== currentUser?.id && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleNudge} className="font-bold text-primary focus:text-primary focus:bg-primary/10">
                      <Hand className="w-4 h-4 mr-2 stroke-[3]" /> {t("task.nudgeOwner")}
                    </DropdownMenuItem>
                  </>
                )}

                {currentUser && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setEditOpen(true); }}>
                      <Pencil className="w-4 h-4 mr-2 text-muted-foreground" /> {t("editTask.trigger")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleArchive} className="text-destructive focus:text-destructive focus:bg-destructive/10 font-bold">
                      <Archive className="w-4 h-4 mr-2 stroke-[3]" /> {t("task.archive")}
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/task/${task.id}`} className="flex items-center w-full cursor-pointer font-bold">
                    <MoveRight className="w-4 h-4 mr-2 text-primary" /> {t("card.viewDetails")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        {task.latestNote && (
          <CardFooter className="pt-0 pb-4 relative z-10">
            <div className="w-full bg-card/60 backdrop-blur-sm rounded-lg p-3 text-sm border border-border/40 text-muted-foreground shadow-inner flex gap-3">
              <MessageSquare className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
              <p className="line-clamp-2 font-medium">{task.latestNote}</p>
            </div>
          </CardFooter>
        )}
      </Card>

      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{t("card.dialog.title", { status: pendingStatus === "blocked" ? t("status.blocked") : t("status.done") })}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder={t("card.dialog.placeholder")} 
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              className="min-h-[120px] resize-none focus-visible:ring-primary font-medium"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={submitStatusChangeWithNote} disabled={changeStatus.isPending} className="font-bold">
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickNoteOpen} onOpenChange={setQuickNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{t("card.action.addNote")}</DialogTitle>
            <DialogDescription className="font-medium">{task.title}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={t("card.dialog.notePlaceholder")}
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              className="min-h-[120px] resize-none focus-visible:ring-primary font-medium"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickNoteOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleQuickNote} disabled={addNote.isPending || !quickNote.trim()} className="font-bold">{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={attemptOpen} onOpenChange={setAttemptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{t("card.action.logAttempt")}</DialogTitle>
            <DialogDescription className="font-medium">{task.title}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={t("task.attemptPlaceholder")}
              value={attemptBody}
              onChange={(e) => setAttemptBody(e.target.value)}
              className="min-h-[120px] resize-none focus-visible:ring-primary font-medium"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttemptOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleQuickAttempt} disabled={addAttempt.isPending || !attemptBody.trim()} className="font-bold">{t("task.logAttempt")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={collabOpen} onOpenChange={setCollabOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{t("collab.title")}</DialogTitle>
            <DialogDescription className="font-medium">{task.title}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <CollaboratorManager taskId={task.id} ownerId={task.ownerId} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollabOpen(false)}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handoffOpen} onOpenChange={setHandoffOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{t("card.action.handoff")}</DialogTitle>
            <DialogDescription className="font-medium">{task.title}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={handoffOwner} onValueChange={setHandoffOwner}>
              <SelectTrigger className="font-medium h-12">
                <SelectValue placeholder={t("card.handoff.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id.toString()} className="font-medium py-2">{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoffOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleHandoff} disabled={updateTask.isPending || !handoffOwner || handoffOwner === task.ownerId?.toString()} className="font-bold">{t("common.confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadEvidence}
      />

      <EditTaskDialog task={task} open={editOpen} onOpenChange={setEditOpen} hideTrigger />
    </>
  );
}
