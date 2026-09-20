import { useEffect, useState } from "react";
import {
  useListUsers,
  useCreateTasksFromDrafts,
  getListTasksQueryKey,
  getGetDashboardQueryKey,
  getGetDigestQueryKey,
  type TaskDraft,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

type EditableDraft = TaskDraft & { _key: string };

const CATEGORIES = ["urgent", "backlog"] as const;
const REASONS = [
  "partner",
  "compliance",
  "manager",
  "client",
  "internal",
  "finance",
  "other",
] as const;

let keyCounter = 0;

type Props = {
  drafts: TaskDraft[];
  onCreated?: () => void;
};

/**
 * Editable review list for AI-suggested task drafts. Lets a manager adjust
 * owner/category/reason/due before committing the selected drafts as tasks.
 */
export function DraftReview({ drafts, onCreated }: Props) {
  const t = useT();
  const { currentUser, isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const createTasks = useCreateTasksFromDrafts();
  const [items, setItems] = useState<EditableDraft[]>([]);

  useEffect(() => {
    setItems(drafts.map((d) => ({ ...d, _key: `d${keyCounter++}` })));
  }, [drafts]);

  if (!isManager) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
        {t("ai.managerOnly")}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        {t("draft.empty")}
      </p>
    );
  }

  const update = (key: string, patch: Partial<EditableDraft>) =>
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, ...patch } : it)),
    );

  const remove = (key: string) =>
    setItems((prev) => prev.filter((it) => it._key !== key));

  const handleCreate = () => {
    const payload: TaskDraft[] = items.map(({ _key, ...rest }) => rest);
    createTasks.mutate(
      { data: { actingUserId: currentUser?.id ?? null, drafts: payload } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDigestQueryKey() });
          toast.success(
            t("draft.toast.created", { count: res.created.length }),
          );
          onCreated?.();
        },
        onError: () => toast.error(t("draft.error")),
      },
    );
  };

  const exportContent = items
    .map((draft, index) =>
      [
        `# ${index + 1}. ${draft.title}`,
        draft.description || "",
        `Category: ${draft.category}`,
        `Reason: ${draft.reason}`,
        draft.dueAt ? `Due: ${draft.dueAt.slice(0, 10)}` : "",
      ].filter(Boolean).join("\n\n"),
    )
    .join("\n\n---\n\n");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" />
        {t("draft.heading")}
      </div>

      <div className="space-y-3">
        <DraftExportButtons title="AI Task Drafts" content={exportContent} hideMarkdown />
        <DraftDocument content={exportContent} />
      </div>

      <div className="space-y-4">
        {items.map((d) => (
          <Card key={d._key} className="glass-card border-border/60 p-4">
            <div className="mb-3 flex items-start gap-2">
              <Input
                value={d.title}
                onChange={(e) => update(d._key, { title: e.target.value })}
                className="font-serif text-base font-semibold"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(d._key)}
                aria-label={t("draft.remove")}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {d.suggestedOwnerName && (
              <p className="mb-2 text-xs text-muted-foreground">
                {t("draft.suggestedOwner", { name: d.suggestedOwnerName })}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("draft.field.owner")}
                </span>
                <Select
                  value={
                    d.suggestedOwnerId != null ? String(d.suggestedOwnerId) : "none"
                  }
                  onValueChange={(v) =>
                    update(d._key, {
                      suggestedOwnerId: v === "none" ? null : parseInt(v),
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={t("common.unassigned")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("common.unassigned")}</SelectItem>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("draft.field.category")}
                </span>
                <Select
                  value={d.category}
                  onValueChange={(v) =>
                    update(d._key, { category: v as TaskDraft["category"] })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("draft.field.reason")}
                </span>
                <Select
                  value={d.reason}
                  onValueChange={(v) =>
                    update(d._key, { reason: v as TaskDraft["reason"] })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`reason.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {t("draft.field.due")}
                </span>
                <Input
                  type="date"
                  className="h-9"
                  value={d.dueAt ? d.dueAt.slice(0, 10) : ""}
                  onChange={(e) =>
                    update(d._key, {
                      dueAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </label>
            </div>

            {d.sourceQuote && (
              <p className="mt-3 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
                {t("draft.source")}: “{d.sourceQuote}”
              </p>
            )}
          </Card>
        ))}
      </div>

      <Button
        type="button"
        onClick={handleCreate}
        disabled={createTasks.isPending}
        className="gap-2"
      >
        {createTasks.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("draft.creating")}
          </>
        ) : (
          t("draft.create", { count: items.length })
        )}
      </Button>
    </div>
  );
}
