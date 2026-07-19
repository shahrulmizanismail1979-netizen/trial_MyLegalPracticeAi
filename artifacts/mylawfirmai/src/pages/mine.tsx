import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useListTasks, getListTasksQueryKey, useGetRecognitionLeaderboard } from "@/lib/api-client";
import { TaskGrid } from "@/components/TaskGrid";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n";
import { LevelBadge } from "@/components/LevelBadge";
import { ProgressRing } from "@/components/ProgressRing";
import { CountUp } from "@/components/CountUp";

export default function MinePage() {
  const { currentUser } = useAuth();
  const t = useT();
  const { data: tasks, isLoading } = useListTasks(
    { memberId: currentUser?.id },
    {
      query: {
        enabled: !!currentUser,
        queryKey: getListTasksQueryKey({ memberId: currentUser?.id }),
      },
    },
  );

  const { data: leaderboard } = useGetRecognitionLeaderboard();
  const myRankIndex = leaderboard?.entries.findIndex(e => e.userId === currentUser?.id) ?? -1;
  const myStats = myRankIndex >= 0 ? leaderboard?.entries[myRankIndex] : undefined;

  if (!currentUser) {
    return (
      <AppLayout>
        <div className="p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground text-lg font-medium">{t("mine.selectUser")}</p>
        </div>
      </AppLayout>
    );
  }

  const urgent = tasks?.filter(t => t.category === "urgent" && t.status !== "done") || [];
  const active = tasks?.filter(t => t.category === "backlog" && ["todo", "in_progress"].includes(t.status)) || [];
  const blocked = tasks?.filter(t => t.status === "blocked") || [];
  const stale = tasks?.filter(t => t.staleFlag && t.status !== "done") || [];
  const done = tasks?.filter(t => t.status === "done") || [];

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text drop-shadow-sm">{t("mine.title")}</h1>
              <p className="text-muted-foreground mt-2 text-base font-medium">{t("mine.subtitle")}</p>
            </div>
            
            {myStats && (
              <div className="flex items-center gap-6 glass-card p-4 rounded-2xl border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <ProgressRing progress={myStats.overallScore} size={80} strokeWidth={6} progressColor="text-primary" circleColor="text-primary/10">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-bold font-serif text-foreground">
                      <CountUp end={myStats.overallScore} />
                    </span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t("game.xp")}</span>
                  </div>
                </ProgressRing>
                <div className="space-y-2">
                  <LevelBadge score={myStats.overallScore} className="scale-110 origin-left shadow-sm" />
                  <div className="flex gap-4 text-sm font-medium">
                    <div className="text-muted-foreground">
                      {t("game.rank")}: <span className="text-foreground font-bold">{myRankIndex >= 0 ? `#${myRankIndex + 1}` : "-"}</span>
                    </div>
                    <div className="text-muted-foreground">
                      {t("recognition.col.completed")}: <span className="text-foreground font-bold">{myStats.completedCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <CreateTaskDialog />
        </header>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="mb-8 bg-muted/60 border border-border/50 p-1.5 h-auto rounded-xl shadow-inner">
            <TabsTrigger value="active" className="data-[state=active]:bg-card data-[state=active]:shadow-md rounded-lg py-2.5 px-5 font-semibold transition-all">
              {t("mine.tab.active")} <span className="ml-2 bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">{urgent.length + active.length}</span>
            </TabsTrigger>
            <TabsTrigger value="blocked" className="data-[state=active]:bg-card data-[state=active]:shadow-md rounded-lg py-2.5 px-5 font-semibold transition-all">
              {t("mine.tab.blocked")} <span className="ml-2 bg-muted px-2 py-0.5 rounded-full text-xs">{blocked.length}</span>
            </TabsTrigger>
            <TabsTrigger value="stale" className="data-[state=active]:bg-card data-[state=active]:shadow-md data-[state=active]:text-orange-600 rounded-lg py-2.5 px-5 font-semibold transition-all">
              {t("mine.tab.stale")} {stale.length > 0 && <span className="ml-2 bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full text-xs animate-pulse">{stale.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="done" className="data-[state=active]:bg-card data-[state=active]:shadow-md rounded-lg py-2.5 px-5 font-semibold transition-all">
              {t("mine.tab.done")} <span className="ml-2 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full text-xs">{done.length}</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-10 focus-visible:outline-none">
            {urgent.length > 0 && (
              <section>
                <h3 className="text-xs font-bold uppercase tracking-widest text-destructive mb-4 bg-destructive/5 inline-block px-3 py-1 rounded border border-destructive/10">{t("mine.section.urgent")}</h3>
                <TaskGrid tasks={urgent} />
              </section>
            )}
            
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 bg-muted/50 inline-block px-3 py-1 rounded border border-border/50">{t("mine.section.backlog")}</h3>
              {active.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-border/60 rounded-2xl glass-card text-muted-foreground font-medium">
                  {t("mine.empty.active")}
                </div>
              ) : (
                <TaskGrid tasks={active} />
              )}
            </section>
          </TabsContent>

          <TabsContent value="blocked" className="focus-visible:outline-none">
            {blocked.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-border/60 rounded-2xl glass-card text-muted-foreground font-medium">
                {t("mine.empty.blocked")}
              </div>
            ) : (
              <TaskGrid tasks={blocked} />
            )}
          </TabsContent>

          <TabsContent value="stale" className="focus-visible:outline-none">
            {stale.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-border/60 rounded-2xl glass-card text-muted-foreground font-medium">
                {t("mine.empty.stale")}
              </div>
            ) : (
              <TaskGrid tasks={stale} />
            )}
          </TabsContent>

          <TabsContent value="done" className="focus-visible:outline-none opacity-80">
            {done.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-border/60 rounded-2xl glass-card text-muted-foreground font-medium">
                {t("mine.empty.done")}
              </div>
            ) : (
              <TaskGrid tasks={done} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
