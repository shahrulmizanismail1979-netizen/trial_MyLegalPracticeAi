import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  useGetMeeting,
  useCreateMeetingTasks,
  useExportMeetingDocx,
  useExportMeetingGoogleDoc,
  useListUsers,
  getGetMeetingQueryKey,
  getListTasksQueryKey,
  getGetDashboardQueryKey,
  getGetDigestQueryKey,
  type Meeting,
  type MeetingActionItem,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useT, useLanguage, useFormatDate } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  FileDown,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ListChecks,
  Users,
  Gavel,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

const REASONS = [
  "partner",
  "compliance",
  "manager",
  "client",
  "internal",
  "finance",
  "other",
] as const;

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printMinutes(meeting: Meeting) {
  const m = meeting.minutes;
  if (!m) return;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const agenda = m.agenda
    .map(
      (a) => `
        <h3>${esc(a.topic)}</h3>
        <p>${esc(a.discussion)}</p>
        ${
          a.decisions.length
            ? `<ul>${a.decisions.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
            : ""
        }`,
    )
    .join("");
  const actions = m.actionItems
    .map(
      (a) =>
        `<li>${esc(a.text)}${a.owner ? ` — <strong>${esc(a.owner)}</strong>` : ""}</li>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(
    m.title,
  )}</title><style>
    body{font-family:Georgia,'Times New Roman',serif;max-width:760px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.55}
    h1{font-size:26px;border-bottom:2px solid #1f4d3a;padding-bottom:8px}
    h2{font-size:18px;margin-top:28px;color:#1f4d3a;text-transform:uppercase;letter-spacing:.05em}
    h3{font-size:15px;margin-bottom:2px}
    ul{margin-top:4px}
    .meta{color:#666;font-size:13px}
  </style></head><body>
    <h1>${esc(m.title)}</h1>
    <p class="meta">${esc(meeting.createdAt)}${
      meeting.createdByName ? ` · ${esc(meeting.createdByName)}` : ""
    }</p>
    <h2>Summary</h2><p>${esc(m.summary)}</p>
    ${m.attendees.length ? `<h2>Attendees</h2><p>${m.attendees.map(esc).join(", ")}</p>` : ""}
    <h2>Agenda &amp; Discussion</h2>${agenda}
    ${m.decisions.length ? `<h2>Decisions</h2><ul>${m.decisions.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
    ${m.actionItems.length ? `<h2>Action Items</h2><ul>${actions}</ul>` : ""}
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function ActionItemRow({
  meetingId,
  item,
  index,
}: {
  meetingId: number;
  item: MeetingActionItem;
  index: number;
}) {
  const t = useT();
  const { currentUser, isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data: users } = useListUsers();
  const createTasks = useCreateMeetingTasks();

  const [ownerId, setOwnerId] = useState<string>("none");
  const [reason, setReason] = useState<string>("manager");

  const handleCreate = () => {
    createTasks.mutate(
      {
        id: meetingId,
        data: {
          actingUserId: currentUser?.id ?? null,
          items: [
            {
              actionItemIndex: index,
              ownerId: ownerId === "none" ? null : parseInt(ownerId),
              category: "urgent",
              reason: reason as (typeof REASONS)[number],
            },
          ],
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getGetMeetingQueryKey(meetingId),
          });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDigestQueryKey() });
          toast.success(t("meeting.toast.taskCreated"));
        },
        onError: () => toast.error(t("draft.error")),
      },
    );
  };

  return (
    <Card className="glass-card border-border/60 p-4">
      <div className="flex items-start gap-3">
        <CircleDot className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1">
          <p className="font-medium text-foreground">{item.text}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {item.owner
              ? `${t("meeting.action.owner")}: ${item.owner}`
              : t("meeting.action.unowned")}
          </p>

          {item.taskId ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {t("meeting.action.created")}
            </p>
          ) : isManager ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9 w-44">
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
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-9 w-40">
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
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={createTasks.isPending}
                className="gap-1.5"
              >
                {createTasks.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ListChecks className="h-3.5 w-3.5" />
                )}
                {t("meeting.action.create")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export default function MeetingDetailPage() {
  const params = useParams();
  const id = parseInt(params.id ?? "0");
  const t = useT();
  const { lang } = useLanguage();
  const formatDate = useFormatDate();
  const { data: meeting, isLoading } = useGetMeeting(id);
  const exportDocx = useExportMeetingDocx();
  const exportGdoc = useExportMeetingGoogleDoc();

  const handleDocx = () => {
    exportDocx.mutate(
      { id },
      {
        onSuccess: (res) => {
          downloadBlob(base64ToBlob(res.base64, res.mimeType), res.filename);
        },
        onError: () => toast.error(t("meeting.export.error")),
      },
    );
  };

  const handleGdoc = () => {
    exportGdoc.mutate(
      { id },
      {
        onSuccess: (res) => {
          toast.success(t("meeting.export.gdocOpened"));
          window.open(res.url, "_blank");
        },
        onError: () => toast.error(t("meeting.export.error")),
      },
    );
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl p-8">
          <div className="h-64 animate-pulse rounded-2xl border border-border/50 bg-muted/40" />
        </div>
      </AppLayout>
    );
  }

  if (!meeting) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl p-8 text-center">
          <p className="text-lg text-muted-foreground">{t("meeting.notFound")}</p>
          <Link href="/meetings">
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("meeting.back")}
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const m = meeting.minutes;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl p-8">
        <Link href="/meetings">
          <button className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            {t("meeting.back")}
          </button>
        </Link>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="jewel-gradient-text font-serif text-4xl font-bold tracking-tight">
              {meeting.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(meeting.createdAt, "d MMM yyyy, HH:mm")}
              {meeting.createdByName ? ` · ${meeting.createdByName}` : ""}
            </p>
          </div>
          {m && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={exportDocx.isPending || exportGdoc.isPending}
                >
                  {exportDocx.isPending || exportGdoc.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                  {t("meeting.export")}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDocx}>
                  {t("meeting.export.word")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => printMinutes(meeting)}>
                  {t("meeting.export.pdf")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleGdoc}>
                  {t("meeting.export.gdoc")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>

        {!m ? (
          <p className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-muted-foreground">
            {t("meeting.noMinutes")}
          </p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="mb-2 font-serif text-lg font-semibold text-primary">
                {t("meeting.summary")}
              </h2>
              <p className="leading-relaxed text-foreground">{m.summary}</p>
            </section>

            {m.attendees.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                  <Users className="h-4 w-4" />
                  {t("meeting.attendees")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {m.attendees.map((a, i) => (
                    <span
                      key={i}
                      className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-sm"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 font-serif text-lg font-semibold text-primary">
                {t("meeting.agenda")}
              </h2>
              <div className="space-y-4">
                {m.agenda.map((a, i) => (
                  <Card key={i} className="glass-card border-border/60 p-4">
                    <h3 className="font-serif font-semibold text-foreground">
                      {a.topic}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {a.discussion}
                    </p>
                    {a.decisions.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {a.decisions.map((d, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-sm text-foreground"
                          >
                            <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                ))}
              </div>
            </section>

            {m.decisions.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                  <Gavel className="h-4 w-4" />
                  {t("meeting.decisions")}
                </h2>
                <ul className="space-y-2">
                  {m.decisions.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5 text-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {d}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {m.actionItems.length > 0 && (
              <section>
                <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                  <ListChecks className="h-4 w-4" />
                  {t("meeting.actionItems")}
                </h2>
                <div className="space-y-3">
                  {m.actionItems.map((item, i) => (
                    <ActionItemRow
                      key={i}
                      meetingId={meeting.id}
                      item={item}
                      index={i}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-primary">
                <FileText className="h-4 w-4" />
                {t("meeting.transcript")}
              </h2>
              <Card className="glass-card border-border/60 p-4">
                <div className="space-y-2">
                  {meeting.segments.map((s, i) => (
                    <p key={i} className="text-sm leading-relaxed">
                      <span className="font-semibold text-primary">{s.speaker}:</span>{" "}
                      <span className="text-foreground">{s.text}</span>
                    </p>
                  ))}
                </div>
              </Card>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
