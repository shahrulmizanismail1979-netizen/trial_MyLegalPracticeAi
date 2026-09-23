import { Link } from "wouter";
import {
  useListMeetings,
  useDeleteMeeting,
  getListMeetingsQueryKey,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { NewMeetingDialog } from "@/components/NewMeetingDialog";
import { useT, useFormatDate } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, ChevronRight, ListChecks } from "lucide-react";
import { toast } from "sonner";

export default function MeetingsPage() {
  const t = useT();
  const formatDate = useFormatDate();
  const queryClient = useQueryClient();
  const { currentUser, isManager } = useAuth();
  const { data: meetings, isLoading } = useListMeetings();
  const deleteMeeting = useDeleteMeeting();

  const handleDelete = (id: number) => {
    if (!currentUser) return;
    if (!window.confirm(t("meetings.deleteConfirm"))) return;
    deleteMeeting.mutate(
      { id, data: { actingUserId: currentUser.id } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
          toast.success(t("meetings.toast.deleted"));
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="jewel-gradient-text font-serif text-4xl font-bold tracking-tight text-foreground">
              {t("meetings.title")}
            </h1>
            <p className="mt-2 text-base font-medium text-muted-foreground">
              {t("meetings.subtitle")}
            </p>
          </div>
          <NewMeetingDialog />
        </header>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <Card className="glass-card border-border/60 p-5">
            <h2 className="font-serif text-lg font-semibold text-foreground">{t("meetings.guide.title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("meetings.guide.body")}</p>
          </Card>
          <Card className="glass-card border-border/60 p-5">
            <h2 className="font-serif text-lg font-semibold text-foreground">{t("meetings.review.title")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("meetings.review.body")}</p>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl border border-border/50 bg-muted/40"
              />
            ))}
          </div>
        ) : !meetings || meetings.length === 0 ? (
          <div className="glass-card rounded-2xl border-2 border-dashed border-border/60 p-12 text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-muted-foreground/60" />
            <h3 className="font-serif text-xl font-semibold text-foreground">
              {t("meetings.empty.title")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-muted-foreground">
              {t("meetings.empty.body")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {meetings.map((m) => (
              <Card
                key={m.id}
                className="glass-card flex items-center justify-between gap-4 border-border/60 p-5 transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/meeting/${m.id}`}
                  className="flex flex-1 items-center gap-4"
                >
                  <div className="jewel-gradient rounded-lg p-2.5 text-sidebar-primary-foreground shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-serif text-lg font-semibold text-foreground">
                      {m.title}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatDate(m.createdAt, "d MMM yyyy, HH:mm")}</span>
                      {m.createdByName && (
                        <span>{t("meetings.card.by", { name: m.createdByName })}</span>
                      )}
                      {m.minutes ? (
                        <span className="inline-flex items-center gap-1 font-medium text-primary">
                          <ListChecks className="h-3.5 w-3.5" />
                          {t("meetings.card.actionItems", {
                            count: m.minutes.actionItems.length,
                          })}
                        </span>
                      ) : (
                        <span className="italic">{t("meetings.card.noMinutes")}</span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-1">
                  {isManager && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m.id)}
                      aria-label={t("meetings.delete")}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                  <Link href={`/meeting/${m.id}`}>
                    <Button variant="ghost" size="icon" aria-label={t("meetings.open")}>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
