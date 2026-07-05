import { useEffect, useState } from "react";
import { Users, TrendingUp, Star } from "lucide-react";
import { useGetAppSubscriberStats, type AppSubscriberStat } from "@workspace/api-client-react";

const APP_META: Record<string, { label: string; shortName: string; color: string }> = {
  MyLitAI:             { label: "Litigation",              shortName: "MyLitAI",        color: "#D4AF37" },
  MySyalitAI:          { label: "Syariah Litigation",      shortName: "MySyalitAI",     color: "#C8A02A" },
  MyCorpAI:            { label: "Corporate Secretary",     shortName: "MyCorpAI",       color: "#E0C050" },
  MyConveyAI:          { label: "Conveyancing",            shortName: "MyConveyAI",     color: "#D4AF37" },
  MyCrimAI:            { label: "Criminal Law",            shortName: "MyCrimAI",       color: "#C8A02A" },
  MyCorpCommBankLitAi: { label: "Corp / Comm / Banking",  shortName: "MyCCBLitAI",     color: "#E0C050" },
  MyAccidentAi:        { label: "Accident & PI",           shortName: "MyAccidentAI",   color: "#D4AF37" },
};

const ORDER = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCorpCommBankLitAi",
  "MyAccidentAi",
];

function AnimatedBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);

  return (
    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function SubscriberStats() {
  const { data, isLoading } = useGetAppSubscriberStats();

  const stats: AppSubscriberStat[] = data ?? [];
  const statsMap = Object.fromEntries(stats.map((s) => [s.appName, s.count]));
  const total = stats.reduce((sum: number, s: AppSubscriberStat) => sum + s.count, 0);
  const maxCount = Math.max(...stats.map((s: AppSubscriberStat) => s.count), 1);
  const isEarlyDays = total === 0;

  return (
    <section className="py-24 px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative">

        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <TrendingUp className="h-4 w-4" />
            Live Community Stats
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-4">
            Malaysia's Legal Community{" "}
            <span className="text-primary">Is Adopting AI</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {isEarlyDays
              ? "Be among the founding members shaping the future of Malaysian legal practice."
              : `Join ${total.toLocaleString()} legal professionals already using the AI Portals.`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-sm p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              {isLoading ? (
                <div className="h-14 w-24 rounded-lg bg-white/5 animate-pulse mx-auto mb-2" />
              ) : (
                <div className="text-6xl font-bold font-serif text-primary mb-2">
                  {isEarlyDays ? "—" : total.toLocaleString()}
                </div>
              )}
              <p className="text-muted-foreground text-sm">
                {isEarlyDays ? "Founding members awaited" : "Active subscribers across all portals"}
              </p>
            </div>

            {isEarlyDays && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
                <Star className="h-6 w-6 text-primary mx-auto mb-3" />
                <p className="font-semibold text-foreground mb-1">Founding Member Status</p>
                <p className="text-sm text-muted-foreground">
                  Early subscribers receive priority support, founding member recognition, and locked-in pricing before rates increase.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-8">
            <h3 className="text-lg font-semibold text-foreground mb-6">Subscribers per Portal</h3>

            {isLoading ? (
              <div className="space-y-5">
                {ORDER.map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
                    <div className="h-2 w-full rounded-full bg-white/5 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {ORDER.map((appName, i) => {
                  const meta = APP_META[appName];
                  const count = statsMap[appName] ?? 0;
                  const pct = isEarlyDays ? 0 : Math.round((count / maxCount) * 100);
                  return (
                    <div key={appName}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground text-sm">{meta.shortName}</span>
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full border border-border/50 bg-white/5">
                            {meta.label}
                          </span>
                        </div>
                        <span className="text-sm font-mono text-primary font-semibold">
                          {isEarlyDays ? (
                            <span className="text-muted-foreground text-xs">Be first</span>
                          ) : (
                            `${count.toLocaleString()} ${count === 1 ? "user" : "users"}`
                          )}
                        </span>
                      </div>
                      <AnimatedBar pct={isEarlyDays ? 3 : Math.max(pct, count > 0 ? 3 : 0)} color={meta.color} delay={i * 120} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "⚖️", label: "Legal Practices", value: isEarlyDays ? "Open" : `${Math.ceil(total * 0.6)}+` },
            { icon: "🏢", label: "In-House Teams", value: isEarlyDays ? "Open" : `${Math.ceil(total * 0.25)}+` },
            { icon: "🎓", label: "Academic Users", value: isEarlyDays ? "Open" : `${Math.ceil(total * 0.15)}+` },
          ].map(({ icon, label, value }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-card/40 px-6 py-5 flex items-center gap-4">
              <span className="text-3xl">{icon}</span>
              <div>
                <div className="text-xl font-bold font-mono text-foreground">{value}</div>
                <div className="text-sm text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
