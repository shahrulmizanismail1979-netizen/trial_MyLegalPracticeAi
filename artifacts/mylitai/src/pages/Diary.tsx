import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  useUpcomingDeadlines,
  categoryMeta,
  daysUntil,
  type UpcomingDeadline,
} from '@/hooks/use-matters';
import { PageHeader, Card, CardContent, Badge } from '@/components/ui';
import {
  CalendarClock,
  AlertTriangle,
  Clock,
  ArrowRight,
  Hash,
} from 'lucide-react';

const HORIZONS = [
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
];

function fmtDate(iso: string) {
  // Display-only DD/MM/YYYY (Malaysian) with weekday. Does not affect stored values or API payloads.
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function bucketOf(d: UpcomingDeadline): 'overdue' | 'today' | 'week' | 'later' {
  const n = daysUntil(d.dueDate);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 7) return 'week';
  return 'later';
}

const BUCKET_META: Record<string, { label: string; accent: string }> = {
  overdue: { label: 'Overdue', accent: 'text-red-400' },
  today: { label: 'Due today', accent: 'text-red-400' },
  week: { label: 'This week', accent: 'text-amber-400' },
  later: { label: 'Upcoming', accent: 'text-muted-foreground' },
};

export default function Diary() {
  const [days, setDays] = useState(60);
  const { data, isLoading } = useUpcomingDeadlines(days);

  const buckets = useMemo(() => {
    const groups: Record<string, UpcomingDeadline[]> = { overdue: [], today: [], week: [], later: [] };
    for (const d of data ?? []) groups[bucketOf(d)].push(d);
    return groups;
  }, [data]);

  const total = data?.length ?? 0;
  const overdueCount = buckets.overdue.length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Deadline Diary"
        description="Every pending deadline across all your matters, in one chronological view — so nothing slips between the files. Overdue items surface first."
      />

      <div className="flex items-center gap-2 mb-6">
        {HORIZONS.map((h) => (
          <button
            key={h.days}
            onClick={() => setDays(h.days)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              days === h.days
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-muted-foreground border-border hover:border-primary/30'
            }`}
          >
            Next {h.label}
          </button>
        ))}
      </div>

      {overdueCount > 0 && (
        <div className="mb-6 flex items-center gap-3 bg-red-950/30 border border-red-800/40 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-200">
            <span className="font-bold">{overdueCount}</span> deadline{overdueCount > 1 ? 's are' : ' is'} overdue. Review and action or mark them done.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading your diary…</div>
      ) : total === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarClock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-1">Nothing due in this window</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No pending deadlines in the next {days} days. Open a matter to add or compute deadlines, and they will appear here.
            </p>
            <Link href="/app/matters">
              <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium mt-4 hover:underline cursor-pointer">
                Go to Matters <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {(['overdue', 'today', 'week', 'later'] as const).map((key) => {
            const items = buckets[key];
            if (items.length === 0) return null;
            const meta = BUCKET_META[key];
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className={`font-serif font-bold text-base ${meta.accent}`}>{meta.label}</h2>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {items.map((d) => {
                    const cat = categoryMeta(d.category);
                    const n = daysUntil(d.dueDate);
                    return (
                      <Link key={d.id} href={`/app/matters/${d.matterId}`}>
                        <Card className="hover:border-primary/50 transition-all cursor-pointer group">
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="flex flex-col items-center justify-center shrink-0 w-14">
                              <span className={`text-lg font-bold leading-none ${n < 0 ? 'text-red-400' : n <= 7 ? 'text-amber-400' : 'text-foreground'}`}>
                                {n < 0 ? Math.abs(n) : n}
                              </span>
                              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{n < 0 ? 'days late' : 'days'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-foreground">{d.title}</span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground/80 mt-0.5 truncate">
                                <span className="truncate">{d.matterTitle}</span>
                                {d.suitNo && <span className="inline-flex items-center gap-1 font-mono"><Hash className="h-3 w-3" />{d.suitNo}</span>}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
