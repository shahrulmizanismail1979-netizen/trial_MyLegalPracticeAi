// Single source of truth for grouping canonical activity action keys into
// filterable categories. Shared by the per-task Change History (task-detail)
// and the team-wide Activity Log page so their filters stay in sync.
export interface ActivityCategory {
  key: string;
  actions: string[];
}

export const activityCategories: ActivityCategory[] = [
  { key: "acknowledged", actions: ["acknowledged"] },
  { key: "status", actions: ["status_changed"] },
  {
    key: "edits",
    actions: [
      "edited",
      "classification_changed",
      "reason_changed",
      "goal_changed",
      "due_changed",
    ],
  },
  { key: "reassignment", actions: ["reassigned"] },
  { key: "notes", actions: ["note_added"] },
  { key: "attempts", actions: ["attempt_added"] },
  { key: "evidence", actions: ["evidence_added", "evidence_deleted"] },
  { key: "nudges", actions: ["nudged"] },
  { key: "archive", actions: ["archived"] },
  {
    key: "collaborators",
    actions: ["collaborator_added", "collaborator_removed"],
  },
];
