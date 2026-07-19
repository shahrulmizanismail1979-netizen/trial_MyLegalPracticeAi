import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useGetDashboard, useGetRecentActivity } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { AlertTriangle, Clock, AlertOctagon, TrendingUp, History, Zap, Download } from "lucide-react";
import { Link, Redirect } from "wouter";
import { useEffect, useState } from "react";
import { useT, useFormatDate } from "@/lib/i18n";
import { useDescribeActivity } from "@/lib/describeActivity";
import { userColor } from "@/lib/userColor";
import { AiBriefingCard } from "@/components/AiBriefingCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { RecentActivityEntry, Dashboard } from "@/lib/api-client";
import { CountUp } from "@/components/CountUp";
import { ProgressRing } from "@/components/ProgressRing";

const ACTIVITY_PAGE_SIZE = 12;

// Wrap a single CSV cell: escape embedded quotes and always quote so commas,
// newlines and leading separators in names can't break the columns.
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function DashboardPage() {
  const { isManager } = useAuth();
  const { data: dashboard, isLoading } = useGetDashboard();
  const [activityCursor, setActivityCursor] = useState<{ createdAt: string; id: number } | null>(null);
  const [activityItems, setActivityItems] = useState<RecentActivityEntry[]>([]);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const { data: recentActivity, isLoading: activityLoading, isFetching: activityFetching } = useGetRecentActivity({
    limit: ACTIVITY_PAGE_SIZE,
    ...(activityCursor ? { cursorCreatedAt: activityCursor.createdAt, cursorId: activityCursor.id } : {}),
  });

  useEffect(() => {
    if (!recentActivity) return;
    setActivityHasMore(recentActivity.hasMore);
    setActivityItems(prev => {
      const seen = new Set(prev.map(i => i.id));
      const merged = [...prev];
      for (const entry of recentActivity.items) {
        if (!seen.has(entry.id)) merged.push(entry);
      }
      return merged;
    });
  }, [recentActivity]);

  const t = useT();
  const formatDate = useFormatDate();
  const describeActivity = useDescribeActivity();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  if (!isManager) {
    return <Redirect to="/urgent" />;
  }

  // Build the three logical sections of the dashboard export from the data
  // currently rendered on screen. Returns localized headers + rows per section.
  const buildExportSections = (d: Dashboard) => {
    const summary = {
      title: t("dashboard.export.summarySheet"),
      headers: [t("dashboard.export.metric"), t("dashboard.export.value")],
      rows: [
        [t("dashboard.unack"), String(d.unacknowledgedUrgent)],
        [t("dashboard.stale"), String(d.staleBacklog)],
        [t("dashboard.blocked"), String(d.blockedNoNote)],
        [
          t("dashboard.ack"),
          d.avgAcknowledgeMinutes != null
            ? `${Math.round(d.avgAcknowledgeMinutes)} ${t("dashboard.ack.unit")}`
            : "-",
        ],
      ],
    };
    const workload = {
      title: t("dashboard.workload"),
      headers: [
        t("dashboard.export.owner"),
        t("dashboard.export.total"),
        t("dashboard.legend.active"),
        t("dashboard.legend.urgent"),
        t("dashboard.export.overdue"),
      ],
      rows: d.tasksByOwner.map((o) => [
        o.ownerName,
        String(o.total),
        String(o.active),
        String(o.urgent),
        String(o.overdue),
      ]),
    };
    const velocity = {
      title: t("dashboard.velocity"),
      headers: [t("dashboard.export.date"), t("dashboard.legend.completed")],
      rows: d.completionTrend.map((p) => [
        formatDate(p.date, "yyyy-MM-dd"),
        String(p.completed),
      ]),
    };
    return [summary, workload, velocity];
  };

  const triggerDownload = (blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mylawfirmai-dashboard-${formatDate(
      new Date().toISOString(),
      "yyyy-MM-dd",
    )}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Download the dashboard metrics as a CSV. Each section is a labelled block
  // separated by a blank line so the single file stays readable in a spreadsheet.
  const handleExportCsv = () => {
    if (exporting || !dashboard) return;
    setExporting("csv");
    try {
      const sections = buildExportSections(dashboard);
      const blocks = sections.map((s) => {
        const lines = [csvCell(s.title)];
        lines.push(s.headers.map(csvCell).join(","));
        for (const row of s.rows) lines.push(row.map(csvCell).join(","));
        return lines.join("\r\n");
      });
      // Prepend a UTF-8 BOM so Excel renders accented/Malay characters correctly.
      const csv = "\uFEFF" + blocks.join("\r\n\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, "csv");
    } catch {
      toast({ variant: "destructive", description: t("export.failed") });
    } finally {
      setExporting(null);
    }
  };

  // Download the dashboard as a true .xlsx with one sheet per section, each with
  // a formatted, frozen header row so it opens cleanly without an import step.
  const handleExportExcel = async () => {
    if (exporting || !dashboard) return;
    setExporting("xlsx");
    try {
      const sections = buildExportSections(dashboard);
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      for (const s of sections) {
        const sheet = workbook.addWorksheet(s.title.slice(0, 31), {
          views: [{ state: "frozen", ySplit: 1 }],
        });
        sheet.columns = s.headers.map((h, i) => ({
          header: h,
          width: i === 0 ? 28 : 16,
        }));
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF002147" },
        };
        headerRow.alignment = { vertical: "middle" };
        for (const row of s.rows) sheet.addRow(row);
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerDownload(blob, "xlsx");
    } catch {
      toast({ variant: "destructive", description: t("export.failed") });
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text drop-shadow-sm">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground mt-2 text-base font-medium">{t("dashboard.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              className="font-semibold rounded-xl"
              disabled={!!exporting || !dashboard}
              onClick={handleExportCsv}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting === "csv" ? t("export.preparing") : t("export.downloadCsv")}
            </Button>
            <Button
              variant="outline"
              className="font-semibold rounded-xl"
              disabled={!!exporting || !dashboard}
              onClick={handleExportExcel}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting === "xlsx" ? t("export.preparing") : t("export.downloadExcel")}
            </Button>
          </div>
        </header>

        <div className="mb-8">
          <AiBriefingCard />
        </div>

        {isLoading || !dashboard ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-36 rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Skeleton className="h-[400px] rounded-2xl" />
              <Skeleton className="h-[400px] rounded-2xl" />
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="glass-card border-destructive/30 bg-gradient-to-br from-destructive/10 to-card shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertTriangle className="w-24 h-24 text-destructive" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                  <CardTitle className="text-sm font-bold tracking-widest uppercase text-destructive/90">{t("dashboard.unack")}</CardTitle>
                  <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-5xl font-serif font-bold text-destructive drop-shadow-sm">
                    <CountUp end={dashboard.unacknowledgedUrgent} />
                  </div>
                  <p className="text-xs text-destructive/80 mt-2 font-semibold uppercase tracking-wider">{t("dashboard.unack.caption")}</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-card shadow-[0_0_20px_rgba(249,115,22,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Clock className="w-24 h-24 text-orange-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                  <CardTitle className="text-sm font-bold tracking-widest uppercase text-orange-600/90">{t("dashboard.stale")}</CardTitle>
                  <Clock className="h-5 w-5 text-orange-500" />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-5xl font-serif font-bold text-orange-600 drop-shadow-sm">
                    <CountUp end={dashboard.staleBacklog} />
                  </div>
                  <p className="text-xs text-orange-600/80 mt-2 font-semibold uppercase tracking-wider">{t("dashboard.stale.caption")}</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-card shadow-[0_0_20px_rgba(168,85,247,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertOctagon className="w-24 h-24 text-purple-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                  <CardTitle className="text-sm font-bold tracking-widest uppercase text-purple-600/90">{t("dashboard.blocked")}</CardTitle>
                  <AlertOctagon className="h-5 w-5 text-purple-500" />
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-5xl font-serif font-bold text-purple-600 drop-shadow-sm">
                    <CountUp end={dashboard.blockedNoNote} />
                  </div>
                  <p className="text-xs text-purple-600/80 mt-2 font-semibold uppercase tracking-wider">{t("dashboard.blocked.caption")}</p>
                </CardContent>
              </Card>

              <Card className="glass-card border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-card shadow-[0_0_20px_rgba(16,185,129,0.1)] relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-24 h-24 text-emerald-500" />
                </div>
                <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                  <CardTitle className="text-sm font-bold tracking-widest uppercase text-emerald-600/90">{t("dashboard.ack")}</CardTitle>
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </CardHeader>
                <CardContent className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="text-5xl font-serif font-bold text-emerald-600 drop-shadow-sm flex items-baseline gap-1">
                      {dashboard.avgAcknowledgeMinutes ? <CountUp end={Math.round(dashboard.avgAcknowledgeMinutes)} /> : '-'}
                      <span className="text-2xl">{t("dashboard.ack.unit")}</span>
                    </div>
                    <p className="text-xs text-emerald-600/80 mt-2 font-semibold uppercase tracking-wider">{t("dashboard.ack.caption")}</p>
                  </div>
                  {dashboard.avgAcknowledgeMinutes && (
                    <ProgressRing progress={Math.max(0, 100 - (dashboard.avgAcknowledgeMinutes / 60) * 100)} size={60} strokeWidth={6} progressColor="text-emerald-500" circleColor="text-emerald-500/20" />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Team Load */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">{t("dashboard.workload")}</CardTitle>
                  <CardDescription>{t("dashboard.workload.caption")}</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.tasksByOwner} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="ownerName" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontWeight: 600, fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontWeight: 600, fontSize: 12 }} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: '0.75rem', fontWeight: 600, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      />
                      <Bar dataKey="active" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 4, 4]} name={t("dashboard.legend.active")} />
                      <Bar dataKey="urgent" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name={t("dashboard.legend.urgent")} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Completion Trend */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="font-serif text-2xl">{t("dashboard.velocity")}</CardTitle>
                  <CardDescription>{t("dashboard.velocity.caption")}</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboard.completionTrend} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: "hsl(var(--muted-foreground))", fontWeight: 600, fontSize: 12 }} 
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getMonth()+1}/${d.getDate()}`;
                        }}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontWeight: 600, fontSize: 12 }} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))", borderRadius: '0.75rem', fontWeight: 600, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                      />
                      <Line type="monotone" dataKey="completed" stroke="hsl(var(--secondary))" strokeWidth={4} dot={{ r: 5, fill: "hsl(var(--card))", strokeWidth: 3 }} activeDot={{ r: 8, fill: "hsl(var(--secondary))", stroke: "hsl(var(--card))", strokeWidth: 2 }} name={t("dashboard.legend.completed")} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 font-serif text-2xl">
                  <History className="w-6 h-6 text-primary" /> {t("dashboard.recentActivity")}
                </CardTitle>
                <CardDescription>{t("dashboard.recentActivity.caption")}</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading && activityItems.length === 0 ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                  </div>
                ) : activityItems.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
                    <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground font-semibold">{t("activity.empty")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {activityItems.map(entry => (
                      <Link
                        key={entry.id}
                        href={`/task/${entry.taskId}`}
                        className="flex items-start gap-4 py-4 px-3 rounded-xl hover:bg-muted/40 transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ring-2 ring-background shadow-md shadow-black/5 mt-0.5" style={userColor(entry.actorId ?? undefined)}>
                          {entry.actorName ? entry.actorName.charAt(0).toUpperCase() : "·"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline gap-3">
                            <span className="font-bold text-sm text-foreground/90 truncate group-hover:text-primary transition-colors">{entry.taskTitle || t("task.notFound")}</span>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded-full">{formatDate(entry.createdAt, "MMM d, h:mm a")}</span>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground leading-snug mt-1">
                            <span className="text-foreground/80 font-semibold">{entry.actorName || t("task.system")}</span>
                            {" — "}
                            {describeActivity(entry)}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                {activityHasMore && (
                  <div className="flex justify-center pt-6">
                    <Button
                      variant="outline"
                      className="font-bold rounded-full px-8 shadow-sm hover:shadow-md hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
                      disabled={activityFetching}
                      onClick={() => {
                        const last = activityItems[activityItems.length - 1];
                        if (last) setActivityCursor({ createdAt: last.createdAt, id: last.id });
                      }}
                    >
                      {activityFetching ? t("dashboard.recentActivity.loading") : t("dashboard.recentActivity.loadMore")}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

