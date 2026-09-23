import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";
import {
  AlertCircle,
  Inbox,
  User as UserIcon,
  CalendarDays,
  Target,
  BookOpen,
  Languages,
  Users,
  ListChecks,
  Sparkles,
  Trophy,
  Mic,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Eye,
  Play,
  Ban,
  Circle,
  Bell,
  StickyNote,
  Hammer,
  Paperclip,
  UserCog,
  Gauge,
  TrendingUp,
  Star,
  Lightbulb,
  Award,
  ArrowUpCircle,
  ChevronRight,
  Palette,
  SlidersHorizontal,
  HelpCircle,
} from "lucide-react";

export default function ManualPage() {
  const t = useT();

  const glance = [
    { icon: ListChecks, key: "tasks", tint: "text-primary", ring: "ring-primary/20", bg: "bg-primary/10" },
    { icon: Sparkles, key: "capture", tint: "text-violet-700 dark:text-violet-300", ring: "ring-violet-500/20", bg: "bg-violet-500/10" },
    { icon: Target, key: "manage", tint: "text-amber-700 dark:text-amber-300", ring: "ring-amber-500/25", bg: "bg-amber-500/10" },
    { icon: Trophy, key: "recognition", tint: "text-yellow-700 dark:text-yellow-300", ring: "ring-yellow-500/25", bg: "bg-yellow-500/10" },
  ] as const;

  const lenses = [
    { icon: AlertCircle, key: "manual.lens.urgent", tint: "text-destructive", bg: "bg-destructive/10", ring: "ring-destructive/20" },
    { icon: Inbox, key: "manual.lens.backlog", tint: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", ring: "ring-amber-500/20" },
    { icon: UserIcon, key: "manual.lens.mine", tint: "text-primary", bg: "bg-primary/10", ring: "ring-primary/20" },
    { icon: CalendarDays, key: "manual.lens.digest", tint: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", ring: "ring-sky-500/20" },
    { icon: Target, key: "manual.lens.goals", tint: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/20" },
  ];

  const statuses = [
    { icon: Circle, key: "status.todo", cls: "bg-muted text-muted-foreground ring-border" },
    { icon: Eye, key: "status.acknowledged", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30" },
    { icon: Play, key: "status.in_progress", cls: "bg-primary/15 text-primary ring-primary/30" },
    { icon: Ban, key: "status.blocked", cls: "bg-destructive/15 text-destructive ring-destructive/30" },
    { icon: CheckCircle2, key: "status.done", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30" },
  ];

  const flow = ["manual.flow.1", "manual.flow.2", "manual.flow.3", "manual.flow.4"];

  const toolkit = [
    { icon: Eye, key: "manual.detail.acknowledge" },
    { icon: StickyNote, key: "manual.detail.notes" },
    { icon: Hammer, key: "manual.detail.attempts" },
    { icon: Paperclip, key: "manual.detail.evidence" },
    { icon: Bell, key: "manual.detail.nudge" },
    { icon: UserCog, key: "manual.detail.reassign" },
  ];

  const capture = [
    { icon: FileText, key: "meetings", tint: "text-violet-700 dark:text-violet-300", bg: "bg-violet-500/10", ring: "ring-violet-500/25" },
    { icon: Mic, key: "voice", tint: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/10", ring: "ring-rose-500/25" },
    { icon: ImageIcon, key: "inbox", tint: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", ring: "ring-sky-500/25" },
  ] as const;

  const scores = [
    { icon: Gauge, key: "speed", weight: 30, color: "bg-primary" },
    { icon: TrendingUp, key: "throughput", weight: 20, color: "bg-sky-500" },
    { icon: Star, key: "quality", weight: 30, color: "bg-amber-500" },
    { icon: Lightbulb, key: "creativity", weight: 20, color: "bg-violet-500" },
  ] as const;

  const cardGuide = [
    { icon: Palette, key: "manual.card.color" },
    { icon: AlertCircle, key: "manual.card.flags" },
    { icon: ListChecks, key: "manual.card.badges" },
    { icon: Gauge, key: "manual.card.score" },
  ] as const;

  const mgrGuide = [
    { icon: SlidersHorizontal, key: "manual.mgr.classify" },
    { icon: UserCog, key: "manual.mgr.assign" },
    { icon: Star, key: "manual.mgr.rate" },
    { icon: Award, key: "manual.mgr.recommend" },
  ] as const;

  const howto = ["ack", "start", "done", "help", "capture"] as const;

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 jewel-gradient">
              <BookOpen className="w-6 h-6" />
            </div>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text">{t("manual.title")}</h1>
          </div>
          <p className="text-muted-foreground text-base font-medium">{t("manual.subtitle")}</p>
        </header>

        <div className="space-y-6">
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">{t("manual.intro.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{t("manual.intro.body")}</p>
            </CardContent>
          </Card>

          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">{t("manual.ops.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["prepare", "review", "record"] as const).map((key, index) => (
                  <div key={key} className="rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">{index + 1}</div>
                    <h3 className="font-serif font-semibold text-foreground">{t(`manual.ops.${key}.title`)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`manual.ops.${key}.body`)}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <h3 className="font-serif font-semibold text-foreground">{t("manual.ops.privacy.title")}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("manual.ops.privacy.body")}</p>
              </div>
              <details className="rounded-xl border border-border/60 p-4">
                <summary className="cursor-pointer font-serif font-semibold text-foreground">{t("manual.ops.faq.title")}</summary>
                <div className="mt-4 space-y-4">
                  {(["ai", "deadline", "delete"] as const).map((key) => (
                    <div key={key}>
                      <p className="text-sm font-semibold text-foreground">{t(`manual.ops.faq.${key}.q`)}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`manual.ops.faq.${key}.a`)}</p>
                    </div>
                  ))}
                </div>
              </details>
            </CardContent>
          </Card>

          {/* At a glance — colourful feature grid */}
          <section>
            <h2 className="font-serif text-xl mb-4 px-1">{t("manual.glance.title")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {glance.map(({ icon: Icon, key, tint, ring, bg }) => (
                <Card key={key} className="glass-card shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className={`mb-3 inline-flex p-3 rounded-xl ${bg} ${tint} ring-1 ${ring}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-serif font-semibold text-base mb-1 text-foreground">{t(`manual.glance.${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(`manual.glance.${key}.body`)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* The five lenses — icon tiles */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">{t("manual.lenses.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lenses.map(({ icon: Icon, key, tint, bg, ring }) => (
                  <li key={key} className="flex items-start gap-4 rounded-xl border border-border/60 bg-card/40 p-4">
                    <div className={`mt-0.5 p-2.5 rounded-lg ${bg} ${tint} ring-1 ${ring} shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(key)}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Reading a task card */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                {t("manual.card.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">{t("manual.card.body")}</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cardGuide.map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-secondary/60 text-primary ring-1 ring-primary/15 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(key)}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Status legend + priority */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-xl">{t("manual.status.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {statuses.map(({ icon: Icon, key, cls }, i) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${cls}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {t(key)}
                      </span>
                      {i < statuses.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground/50" />}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("manual.status.body")}</p>
              </CardContent>
            </Card>

            <Card className="glass-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-xl">{t("manual.priority.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-destructive/10 ring-1 ring-destructive/20 p-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("manual.priority.urgent")}</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 p-3">
                  <Inbox className="w-5 h-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("manual.priority.backlog")}</p>
                </div>
                <p className="text-xs text-muted-foreground/80 italic leading-relaxed">{t("manual.priority.note")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Everyday flow — connected steps */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">{t("manual.flow.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-primary/40 before:to-primary/5">
                {flow.map((key, i) => (
                  <li key={key} className="relative flex items-start gap-4">
                    <span className="relative z-10 shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center shadow-sm ring-4 ring-background">
                      {i + 1}
                    </span>
                    <p className="text-muted-foreground leading-relaxed pt-0.5">{t(key)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* How do I */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-primary" />
                {t("manual.howto.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {howto.map((k) => (
                <div key={k} className="rounded-lg border border-border/50 p-4">
                  <p className="font-semibold text-sm text-foreground mb-1">{t(`manual.howto.${k}.q`)}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`manual.howto.${k}.a`)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Task toolkit */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl">{t("manual.detail.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {toolkit.map(({ icon: Icon, key }) => (
                  <div key={key} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-secondary/60 text-primary ring-1 ring-primary/15 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(key)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI capture trio */}
          <section>
            <div className="mb-4 px-1">
              <h2 className="font-serif text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-300" />
                {t("manual.capture.title")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t("manual.capture.body")}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {capture.map(({ icon: Icon, key, tint, bg, ring }) => (
                <Card key={key} className="glass-card shadow-sm">
                  <CardContent className="pt-6">
                    <div className={`mb-3 inline-flex p-3 rounded-xl ${bg} ${tint} ring-1 ${ring}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-serif font-semibold text-base mb-1 text-foreground">{t(`manual.capture.${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(`manual.capture.${key}.body`)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Recognition & scoring */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />
                {t("manual.recognition.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">{t("manual.recognition.body")}</p>
              <div className="space-y-4">
                {scores.map(({ icon: Icon, key, weight, color }) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className="w-4 h-4 text-foreground/70" />
                      <span className="text-sm font-semibold text-foreground">{t(`manual.recognition.${key}`)}</span>
                      <span className="ml-auto text-xs font-bold tabular-nums text-muted-foreground">{weight}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${weight}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">{t(`manual.recognition.${key}.desc`)}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/25 p-3">
                  <Award className="w-5 h-5 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("manual.recognition.bonus")}</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg bg-yellow-500/10 ring-1 ring-yellow-500/25 p-3">
                  <ArrowUpCircle className="w-5 h-5 text-yellow-700 dark:text-yellow-300 shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">{t("manual.recognition.promotion")}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground/80 italic leading-relaxed mt-4">{t("manual.recognition.rate")}</p>
            </CardContent>
          </Card>

          {/* For managers */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-700 dark:text-amber-300" />
                {t("manual.mgr.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed mb-4">{t("manual.mgr.body")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mgrGuide.map(({ icon: Icon, key }) => (
                  <div key={key} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t(key)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Roles */}
          <Card className="glass-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {t("manual.roles.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{t("manual.roles.body")}</p>
            </CardContent>
          </Card>

          {/* Users + language */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-xl flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-primary" />
                  {t("manual.user.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{t("manual.user.body")}</p>
              </CardContent>
            </Card>

            <Card className="glass-card shadow-sm">
              <CardHeader>
                <CardTitle className="font-serif text-xl flex items-center gap-2">
                  <Languages className="w-5 h-5 text-primary" />
                  {t("manual.lang.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">{t("manual.lang.body")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
