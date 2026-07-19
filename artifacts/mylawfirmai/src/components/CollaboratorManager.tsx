import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListTaskCollaborators,
  useAddTaskCollaborator,
  useRemoveTaskCollaborator,
  useListUsers,
  getListTaskCollaboratorsQueryKey,
  getGetTaskQueryKey,
  getListUsersQueryKey,
  getListTaskActivityQueryKey,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { userColor } from "@/lib/userColor";

export function CollaboratorManager({ taskId, ownerId }: { taskId: number; ownerId?: number | null }) {
  const t = useT();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: collaborators } = useListTaskCollaborators(taskId, {
    query: { enabled: !!taskId, queryKey: getListTaskCollaboratorsQueryKey(taskId) },
  });
  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });
  const addCollaborator = useAddTaskCollaborator();
  const removeCollaborator = useRemoveTaskCollaborator();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListTaskCollaboratorsQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getGetTaskQueryKey(taskId) });
    queryClient.invalidateQueries({ queryKey: getListTaskActivityQueryKey(taskId) });
  };

  const existingIds = new Set((collaborators ?? []).map((c) => c.userId));
  const available = (users ?? []).filter(
    (u) => !existingIds.has(u.id) && u.id !== ownerId,
  );

  const handleAdd = () => {
    if (!selected || !currentUser) return;
    addCollaborator.mutate(
      { id: taskId, data: { userId: parseInt(selected), actingUserId: currentUser.id } },
      {
        onSuccess: () => { invalidate(); setSelected(""); toast.success(t("collab.toast.added")); },
        onError: () => toast.error(t("collab.toast.error")),
      },
    );
  };

  const handleRemove = (userId: number) => {
    removeCollaborator.mutate(
      { id: taskId, userId, data: currentUser ? { actingUserId: currentUser.id } : undefined },
      {
        onSuccess: () => { invalidate(); toast.success(t("collab.toast.removed")); },
        onError: () => toast.error(t("collab.toast.error")),
      },
    );
  };

  return (
    <div className="glass-card border border-border/40 rounded-3xl p-6 space-y-4 shadow-sm">
      <div>
        <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Users className="w-4 h-4" /> {t("collab.title")}
        </h3>
        <p className="text-[11px] text-muted-foreground/80 leading-snug mt-1.5">{t("collab.hint")}</p>
      </div>

      {collaborators && collaborators.length > 0 ? (
        <div className="space-y-2">
          {collaborators.map((c) => (
            <div key={c.userId} className="flex items-center gap-2.5 bg-background/50 rounded-xl px-3 py-2 border border-border/40">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ring-1 ring-black/10 shrink-0" style={userColor(c.userId)}>
                {c.name ? c.name.charAt(0).toUpperCase() : "?"}
              </div>
              <span className="flex-1 text-sm font-medium text-foreground/90 truncate">{c.name || `#${c.userId}`}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                onClick={() => handleRemove(c.userId)}
                disabled={removeCollaborator.isPending}
                aria-label={t("collab.remove")}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground font-medium">{t("collab.empty")}</p>
      )}

      <div className="flex items-center gap-2">
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="flex-1 bg-background/50 rounded-xl h-10 font-medium text-sm">
            <SelectValue placeholder={t("collab.placeholder")} />
          </SelectTrigger>
          <SelectContent className="rounded-xl font-medium">
            {available.map((u) => (
              <SelectItem key={u.id} value={u.id.toString()}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={handleAdd}
          disabled={!selected || addCollaborator.isPending}
          className="rounded-xl h-10 font-semibold shrink-0"
        >
          <UserPlus className="w-4 h-4 mr-1.5" /> {t("collab.add")}
        </Button>
      </div>
    </div>
  );
}
