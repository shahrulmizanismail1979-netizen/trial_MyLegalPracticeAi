import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import {
  useGetRecentActivity,
  getRecentActivity,
  useListUsers,
  getListUsersQueryKey,
} from "@/lib/api-client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { History, ArrowRight, Download } from "lucide-react";
import { Link, Redirect } from "wouter";
import { useMemo, useState } from "react";
import { useT, useFormatDate } from "@/lib/i18n";
import { useDescribeActivity } from "@/lib/describeActivity";
import { activityCategories } from "@/lib/activityCategories";
import { userColor } from "@/lib/userColor";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv, downloadXlsx } from "@/lib/exportSheet";

const ACTIVITY_PAGE_SIZE = 20;

type DatePreset = "all" | "today" | "week" | "month" | "custom";

const DATE_PRESETS: DatePreset[] = ["all", "today", "week", "month", "custom"];

// Resolve the selected preset (or a custom from/to pair, as <input type="date">
// yyyy-mm-dd strings) into ISO timestamps for the API. `to` is exclusive, so
// custom end dates add a day to make the chosen day inclusive.
function dateRangeFor(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { fromParam?: string; toParam?: string } {
  if (preset === "all") return {};

  if (preset === "custom") {
    const fromParam = customFrom
      ? new Date(`${customFrom}T00:00:00`).toISOString()
      : undefined;
    const toParam = customTo
      ? new Date(
          new Date(`${customTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000,
        ).toISOString()
      : undefined;
    return { fromParam, toParam };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (preset === "week") {
    // Start of the current week (Monday).
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
  } else if (preset === "month") {
    start.setDate(1);
  }
  return { fromParam: start.toISOString() };
}

// Resolve the selected preset (or custom from/to) into the actual display dates
// for the caption above the results. Unlike `dateRangeFor`, the `to` here is the
// inclusive day actually being shown (no exclusive +1 day), and presets bounded
// by "now" report today as their end so the caption reads as a real range.
function displayRangeFor(
  preset: DatePreset,
  customFrom: string,
  customTo: string,
): { from?: Date; to?: Date } {
  if (preset === "all") return {};

  if (preset === "custom") {
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`) : undefined,
      to: customTo ? new Date(`${customTo}T00:00:00`) : undefined,
    };
  }

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  if (preset === "week") {
    const day = (from.getDay() + 6) % 7;
    from.setDate(from.getDate() - day);
  } else if (preset === "month") {
    from.setDate(1);
  }
  return { from, to: new Date() };
}

export default function ActivityPage() {
  const { isManager } = useAuth();
  const t = useT();
  const formatDate = useFormatDate();
  const describeActivity = useDescribeActivity();
  const { toast } = useToast();

  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [limit, setLimit] = useState(ACTIVITY_PAGE_SIZE);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const { data: users } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });

  const actionsParam = useMemo(() => {
    if (historyFilter === "all") return undefined;
    const cat = activityCategories.find((c) => c.key === historyFilter);
    return cat ? cat.actions.join(",") : undefined;
  }, [historyFilter]);

  const actorParam =
    actorFilter === "all"
      ? undefined
      : actorFilter === "__system__"
        ? "system"
        : actorFilter;

  const { fromParam, toParam } = useMemo(
    () => dateRangeFor(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo],
  );

  const {
    data: activity,
    isLoading,
    isFetching,
  } = useGetRecentActivity({
    limit,
    ...(actionsParam ? { actions: actionsParam } : {}),
    ...(actorParam ? { actor: actorParam } : {}),
    ...(fromParam ? { from: fromParam } : {}),
    ...(toParam ? { to: toParam } : {}),
  });

  if (!isManager) {
    return <Redirect to="/urgent" />;
  }

  const resetTo = (setter: (v: string) => void, value: string) => {
    setter(value);
    setLimit(ACTIVITY_PAGE_SIZE);
  };

  // Column headers shared by both the CSV and Excel exports.
  const exportHeaders = () => [
    t("activityLog.col.timestamp"),
    t("activityLog.col.actor"),
    t("activityLog.col.action"),
    t("activityLog.col.taskTitle"),
    t("activityLog.col.taskId"),
  ];

  // Map a single activity entry to a localized row matching exportHeaders().
  const exportRow = (entry: (typeof items)[number]): string[] => [
    formatDate(entry.createdAt, "yyyy-MM-dd HH:mm:ss"),
    entry.actorName || t("task.system"),
    describeActivity(entry),
    entry.taskTitle || t("activityLog.untitledTask"),
    String(entry.taskId),
  ];

  // Fetch the FULL filtered range (not just the loaded page) via the server's
  // export mode so pagination is bypassed. Returns null when empty.
  const fetchExportRows = async () => {
    const full = await getRecentActivity({
      export: true,
      ...(actionsParam ? { actions: actionsParam } : {}),
      ...(actorParam ? { actor: actorParam } : {}),
      ...(fromParam ? { from: fromParam } : {}),
      ...(toParam ? { to: toParam } : {}),
    });
    const rows = full.items ?? [];
    if (rows.length === 0) {
      toast({ description: t("activityLog.exportEmpty") });
      return null;
    }
    return rows;
  };

  const exportFilename = (extension: string) =>
    `mylawfirmai-activity-${formatDate(
      new Date().toISOString(),
      "yyyy-MM-dd",
    )}.${extension}`;

  // Download the filtered range as a CSV. Renders the same localized action
  // text shown on screen.
  const handleExportCsv = async () => {
    if (exporting) return;
    setExporting("csv");
    try {
      const rows = await fetchExportRows();
      if (!rows) return;

      downloadCsv(
        exportHeaders(),
        rows.map(exportRow),
        exportFilename("csv"),
      );
    } catch {
      toast({
        variant: "destructive",
        description: t("activityLog.exportFailed"),
      });
    } finally {
      setExporting(null);
    }
  };

  // Download the filtered range as a true .xlsx with a formatted, frozen header
  // row and proper column widths so it opens cleanly without an import step.
  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting("xlsx");
    try {
      const rows = await fetchExportRows();
      if (!rows) return;

      await downloadXlsx(
        t("activityLog.title"),
        exportHeaders(),
        rows.map(exportRow),
        exportFilename("xlsx"),
        // Generous widths; task title gets the most room.
        [22, 22, 60, 40, 10],
      );
    } catch {
      toast({
        variant: "destructive",
        description: t("activityLog.exportFailed"),
      });
    } finally {
      setExporting(null);
    }
  };

  const selectDatePreset = (preset: DatePreset) => {
    setDateFilter(preset);
    if (preset !== "custom") {
      setCustomFrom("");
      setCustomTo("");
    }
    setLimit(ACTIVITY_PAGE_SIZE);
  };

  const applyCustomRange = () => {
    setLimit(ACTIVITY_PAGE_SIZE);
  };

  const items = activity?.items ?? [];

  const rangeCaption = useMemo(() => {
    const { from, to } = displayRangeFor(dateFilter, customFrom, customTo);
    const dateFmt = "MMM d, yyyy";
    if (!from && !to) return t("activity.range.allTime");
    if (from && to) {
      const fromStr = formatDate(from, dateFmt);
      const toStr = formatDate(to, dateFmt);
      if (fromStr === toStr) return t("activity.range.on", { date: fromStr });
      return t("activity.range.between", { from: fromStr, to: toStr });
    }
    if (from) return t("activity.range.from", { from: formatDate(from, dateFmt) });
    return t("activity.range.until", { to: formatDate(to!, dateFmt) });
  }, [dateFilter, customFrom, customTo, t, formatDate]);

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text flex items-center gap-3">
              <History className="w-8 h-8 text-primary" />{" "}
              {t("activityLog.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-base font-medium">
              {t("activityLog.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              className="font-semibold rounded-xl"
              disabled={!!exporting}
              onClick={handleExportCsv}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting === "csv"
                ? t("activityLog.exporting")
                : t("activityLog.downloadCsv")}
            </Button>
            <Button
              variant="outline"
              className="font-semibold rounded-xl"
              disabled={!!exporting}
              onClick={handleExportExcel}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting === "xlsx"
                ? t("activityLog.exporting")
                : t("activityLog.downloadExcel")}
            </Button>
          </div>
        </header>

        <div className="space-y-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {[{ key: "all", actions: [] as string[] }, ...activityCategories].map(
              (c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => resetTo(setHistoryFilter, c.key)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                    historyFilter === c.key
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
                  }`}
                >
                  {t(`activity.filter.${c.key}`)}
                </button>
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              {t("activity.filterByActor")}
            </span>
            <button
              type="button"
              onClick={() => resetTo(setActorFilter, "all")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                actorFilter === "all"
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
              }`}
            >
              {t("activity.actor.all")}
            </button>
            {users?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => resetTo(setActorFilter, String(u.id))}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                  actorFilter === String(u.id)
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
                }`}
              >
                {u.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => resetTo(setActorFilter, "__system__")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                actorFilter === "__system__"
                  ? "bg-primary text-primary-foreground ring-primary"
                  : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
              }`}
            >
              {t("task.system")}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">
              {t("activity.filterByDate")}
            </span>
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => selectDatePreset(preset)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full ring-1 transition-colors ${
                  dateFilter === preset
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-muted/40 text-muted-foreground ring-border/50 hover:bg-muted"
                }`}
              >
                {t(`activity.date.${preset}`)}
              </button>
            ))}
          </div>
          {dateFilter === "custom" && (
            <div className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/20 ring-1 ring-border/40 p-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("activity.date.from")}
                </span>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="text-sm font-medium rounded-lg border border-border/60 bg-background px-3 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("activity.date.to")}
                </span>
                <input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="text-sm font-medium rounded-lg border border-border/60 bg-background px-3 py-1.5"
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="font-semibold rounded-lg"
                onClick={applyCustomRange}
              >
                {t("activity.date.apply")}
              </Button>
              {(customFrom || customTo) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="font-semibold rounded-lg"
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                    setLimit(ACTIVITY_PAGE_SIZE);
                  }}
                >
                  {t("activity.date.clear")}
                </Button>
              )}
            </div>
          )}
        </div>

        <p className="text-sm font-semibold text-muted-foreground mb-4">
          {rangeCaption}
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground font-medium py-16 border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
            {t("activityLog.empty")}
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((entry) => (
              <Card
                key={entry.id}
                className="shadow-sm border-border/40 rounded-2xl overflow-hidden glass-card"
              >
                <div className="p-5 flex items-start gap-4">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-black/10"
                    style={userColor(entry.actorId ?? undefined)}
                  >
                    {entry.actorName
                      ? entry.actorName.charAt(0).toUpperCase()
                      : "·"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-3 mb-1">
                      <span className="font-semibold text-foreground/90">
                        {entry.actorName || t("task.system")}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md shrink-0">
                        {formatDate(entry.createdAt, "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
                      {describeActivity(entry)}
                    </p>
                    <Link
                      href={`/task/${entry.taskId}`}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      {entry.taskTitle || t("activityLog.untitledTask")}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </Card>
            ))}

            {activity?.hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  className="font-semibold rounded-xl"
                  disabled={isFetching}
                  onClick={() => setLimit((l) => l + ACTIVITY_PAGE_SIZE)}
                >
                  {isFetching
                    ? t("activityLog.loading")
                    : t("activityLog.loadMore")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
