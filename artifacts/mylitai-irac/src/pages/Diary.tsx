import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  Loader2,
  CircleAlert,
  TriangleAlert,
  CalendarDays,
  Scale,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AccessGate } from "@/components/AccessGate";
import { useLanguage } from "@/contexts/LanguageContext";
import { getUpcomingDeadlines, type UpcomingDeadline } from "@/lib/irac-api";

const selectCls =
  "flex h-10 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]";

const HORIZONS = [14, 30, 60, 90];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(target: Date) {
  const now = startOfDay(new Date());
  const t = startOfDay(target);
  return Math.round((t.getTime() - now.getTime()) / 86_400_000);
}

function DiaryBody() {
  const { t } = useLanguage();
  const [days, setDays] = useState(60);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["upcoming-deadlines", days],
    queryFn: () => getUpcomingDeadlines(days),
  });

  const buckets = useMemo(() => {
    const overdue: UpcomingDeadline[] = [];
    const today: UpcomingDeadline[] = [];
    const week: UpcomingDeadline[] = [];
    const later: UpcomingDeadline[] = [];
    for (const d of data ?? []) {
      const diff = daysBetween(new Date(d.dueDate));
      if (diff < 0) overdue.push(d);
      else if (diff === 0) today.push(d);
      else if (diff <= 7) week.push(d);
      else later.push(d);
    }
    return { overdue, today, week, later };
  }, [data]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const relLabel = (iso: string) => {
    const diff = daysBetween(new Date(iso));
    if (diff < 0) return t("diary.daysOverdue").replace("{n}", String(Math.abs(diff)));
    if (diff === 0) return t("diary.dueToday");
    if (diff === 1) return t("diary.tomorrow");
    return t("diary.inDays").replace("{n}", String(diff));
  };

  const Section = ({
    title,
    items,
    tone,
    icon: Icon,
  }: {
    title: string;
    items: UpcomingDeadline[];
    tone: "overdue" | "today" | "week" | "later";
    icon: React.ElementType;
  }) => {
    if (items.length === 0) return null;
    const toneCls: Record<string, string> = {
      overdue: "text-rose-400",
      today: "text-amber-400",
      week: "text-[hsl(var(--gold-bright))]",
      later: "text-muted-foreground",
    };
    return (
      <div>
        <h2 className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3 ${toneCls[tone]}`}>
          <Icon className="h-4 w-4" /> {title}{" "}
          <span className="text-muted-foreground font-normal">({items.length})</span>
        </h2>
        <div className="space-y-2">
          {items.map((d) => (
            <Card key={d.id} className={tone === "overdue" ? "border-rose-500/40" : undefined}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground leading-snug">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {d.matterTitle}
                    {d.suitNo ? ` · ${d.suitNo}` : ""}
                  </p>
                  {d.basis && (
                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                      <Scale className="h-3 w-3 shrink-0" /> {d.basis}
                    </p>
                  )}
                  {d.notes && (
                    <p className="text-[11px] text-foreground/60 mt-1 leading-snug">{d.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">{fmtDate(d.dueDate)}</p>
                  <p className={`text-[11px] ${toneCls[tone]}`}>{relLabel(d.dueDate)}</p>
                  {d.category && (
                    <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                      {d.category}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const empty =
    !isLoading &&
    !isError &&
    (data?.length ?? 0) === 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 w-full">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">
            {t("diary.title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">{t("diary.desc")}</p>
          <div className="rule-gold mt-4" />
        </div>
        <div>
          <select
            className={selectCls}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {HORIZONS.map((h) => (
              <option key={h} value={h}>
                {t("diary.next").replace("{n}", String(h))}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> {t("common.errorRetry")}
        </div>
      )}
      {empty && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <CalendarDays className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--gold)/0.5)]" />
            {t("diary.empty")}
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-8">
          <Section title={t("diary.overdue")} items={buckets.overdue} tone="overdue" icon={TriangleAlert} />
          <Section title={t("diary.today")} items={buckets.today} tone="today" icon={CalendarClock} />
          <Section title={t("diary.thisWeek")} items={buckets.week} tone="week" icon={CalendarClock} />
          <Section title={t("diary.upcoming")} items={buckets.later} tone="later" icon={CalendarDays} />
        </div>
      )}
    </div>
  );
}

export default function Diary() {
  return (
    <AccessGate>
      <DiaryBody />
    </AccessGate>
  );
}
