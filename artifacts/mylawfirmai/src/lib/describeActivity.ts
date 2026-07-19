import { useListGoals, getListGoalsQueryKey } from "@/lib/api-client";
import { useT, useLabels, useFormatDate } from "./i18n";

// Minimal shape shared by per-task activity entries and the org-wide recent
// activity stream — only the canonical `action` key and `meta` snapshot are
// needed to render a bilingual message.
export interface ActivityLike {
  action: string;
  meta?: Record<string, unknown> | null;
}

// Reusable bilingual renderer for task activity entries. Mirrors the rendering
// pattern that originated on the task-detail page so the Dashboard recent
// activity panel stays in sync with the per-task audit trail.
export function useDescribeActivity(): (entry: ActivityLike) => string {
  const t = useT();
  const labels = useLabels();
  const formatDate = useFormatDate();
  const { data: goals } = useListGoals(undefined, {
    query: { queryKey: getListGoalsQueryKey() },
  });

  return (entry: ActivityLike): string => {
    const meta = (entry.meta ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (v == null ? null : String(v));
    switch (entry.action) {
      case "reassigned": {
        const from = str(meta.from);
        const to = str(meta.to);
        if (!from && to) return t("activity.assigned", { to });
        if (from && !to) return t("activity.unassigned", { from });
        return t("activity.reassigned", {
          from: from ?? t("common.unassigned"),
          to: to ?? t("common.unassigned"),
        });
      }
      case "status_changed":
        return t("activity.status_changed", {
          from: labels.status(str(meta.from) ?? ""),
          to: labels.status(str(meta.to) ?? ""),
        });
      case "classification_changed":
        return t("activity.classification_changed", {
          from: labels.category(str(meta.from) ?? ""),
          to: labels.category(str(meta.to) ?? ""),
        });
      case "reason_changed":
        return t("activity.reason_changed", {
          from: labels.reason(str(meta.from) ?? ""),
          to: labels.reason(str(meta.to) ?? ""),
        });
      case "goal_changed": {
        const toId = meta.to == null ? null : Number(meta.to);
        if (toId == null) return t("activity.goal_cleared");
        const title = goals?.find((g) => g.id === toId)?.title ?? `#${toId}`;
        return t("activity.goal_changed", { to: title });
      }
      case "due_changed": {
        const to = str(meta.to);
        if (!to) return t("activity.due_cleared");
        return t("activity.due_changed", { to: formatDate(to, "MMM d, yyyy") });
      }
      case "edited": {
        const fields = Array.isArray(meta.fields)
          ? (meta.fields as string[]).map((f) => t(`activity.field.${f}`))
          : [];
        return t("activity.edited", {
          fields: fields.length ? fields.join(", ") : t("activity.none"),
        });
      }
      case "archived":
        return t("activity.archived");
      case "acknowledged":
        return t("activity.acknowledged");
      case "nudged": {
        const target = str(meta.target);
        if (!target) return t("activity.nudged_owner");
        return t("activity.nudged", { target });
      }
      case "note_added":
        return t("activity.note_added");
      case "attempt_added": {
        const source = str(meta.source);
        if (source === "voice") return t("activity.attempt_added_voice");
        return t("activity.attempt_added");
      }
      case "evidence_added":
        return t("activity.evidence_added", {
          target: str(meta.target) ?? t("task.system"),
        });
      case "evidence_deleted":
        return t("activity.evidence_deleted", {
          target: str(meta.target) ?? t("task.system"),
        });
      case "collaborator_added":
        return t("activity.collaborator_added", {
          target: str(meta.target) ?? t("task.system"),
        });
      case "collaborator_removed":
        return t("activity.collaborator_removed", {
          target: str(meta.target) ?? t("task.system"),
        });
      default:
        return t("activity.unknown");
    }
  };
}
