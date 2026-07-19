import { AppLayout } from "@/components/layout/AppLayout";
import {
  useGetDigest,
  useGetRecentActivity,
  getGetRecentActivityQueryKey,
} from "@/lib/api-client";
import { TaskGrid } from "@/components/TaskGrid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Flame, UserX, CalendarClock, Moon, Sparkles, History } from "lucide-react";
import { Link } from "wouter";
import { useT, useFormatDate } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useDescribeActivity } from "@/lib/describeActivity";
import { userColor } from "@/lib/userColor";

function DigestSection({ title, icon: Icon, description, tasks, emptyText }: any) {
  if (!tasks || tasks.length === 0) return null;
  
  return (
    <section className="mb-14">
      <div className="flex items-center gap-4 mb-6 border-b border-border/40 pb-4">
        <div className="p-3 bg-primary/10 text-primary rounded-xl ring-1 ring-primary/20 shadow-sm jewel-gradient-text bg-clip-border">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-serif font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <TaskGrid tasks={tasks} />
    </section>
  );
}

function RecentChangesSection() {
  const t = useT();
  const formatDate = useFormatDate();
  const describeActivity = useDescribeActivity();
  const { data: recentActivity, isLoading } = useGetRecentActivity(
    { limit: 8 },
    { query: { queryKey: getGetRecentActivityQueryKey({ limit: 8 }) } },
  );

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-primary" /> {t("dashboard.recentActivity")}
        </CardTitle>
        <CardDescription>{t("dashboard.recentActivity.caption")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : (recentActivity?.items.length ?? 0) === 0 ? (
          <p className="text-center text-muted-foreground font-medium py-10 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
            {t("activity.empty")}
          </p>
        ) : (
          <div className="divide-y divide-border/40">
            {recentActivity?.items.map((entry) => (
              <Link
                key={entry.id}
                href={`/task/${entry.taskId}`}
                className="flex items-start gap-3 py-3 -mx-2 px-2 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-1 ring-black/10 mt-0.5"
                  style={userColor(entry.actorId ?? undefined)}
                >
                  {entry.actorName ? entry.actorName.charAt(0).toUpperCase() : "·"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="font-semibold text-sm text-foreground/90 truncate">
                      {entry.taskTitle || t("task.notFound")}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground shrink-0">
                      {formatDate(entry.createdAt, "MMM d, h:mm a")}
                    </span>
                  </div>
                  <p className="text-[13px] font-medium text-muted-foreground leading-snug mt-0.5">
                    <span className="text-foreground/70">{entry.actorName || t("task.system")}</span>
                    {" — "}
                    {describeActivity(entry)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DigestPage() {
  const { data: digest, isLoading } = useGetDigest();
  const { isManager } = useAuth();
  const t = useT();

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        <header className="mb-14 text-center py-16 bg-card border rounded-[2rem] shadow-sm relative overflow-hidden glass-card">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background/5 to-amber-500/10 pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-amber-500 to-primary" />
          <h1 className="text-5xl font-serif font-bold tracking-tight text-foreground relative z-10 jewel-gradient-text">{t("digest.title")}</h1>
          <p className="text-muted-foreground mt-4 text-lg relative z-10 max-w-xl mx-auto font-medium">
            {t("digest.subtitle")}
          </p>
        </header>

        {isLoading || !digest ? (
          <div className="space-y-8">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <DigestSection 
              title={t("digest.newlyStale.title")} 
              icon={Flame}
              description={t("digest.newlyStale.desc")}
              tasks={digest.newlyStale} 
            />
            <DigestSection 
              title={t("digest.noOwner.title")} 
              icon={UserX}
              description={t("digest.noOwner.desc")}
              tasks={digest.noOwner} 
            />
            <DigestSection 
              title={t("digest.approachingDue.title")} 
              icon={CalendarClock}
              description={t("digest.approachingDue.desc")}
              tasks={digest.approachingDue} 
            />
            <DigestSection 
              title={t("digest.deepSleep.title")} 
              icon={Moon}
              description={t("digest.deepSleep.desc")}
              tasks={digest.inactiveOverWeek} 
            />
            <DigestSection 
              title={t("digest.recommended.title")} 
              icon={Sparkles}
              description={t("digest.recommended.desc")}
              tasks={digest.recommended} 
            />
            
            {Object.values(digest).every(arr => arr.length === 0) && (
              <div className="py-24 text-center text-muted-foreground glass-card rounded-3xl border-2 border-dashed border-border/60">
                <div className="w-24 h-24 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-3xl font-serif font-bold text-foreground mb-3 jewel-gradient-text">{t("digest.emptyTitle")}</h3>
                <p className="font-medium text-lg text-muted-foreground/80">{t("digest.emptyBody")}</p>
              </div>
            )}
          </div>
        )}

        {isManager && <RecentChangesSection />}
      </div>
    </AppLayout>
  );
}
