import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Brain,
  ShieldCheck,
  Sparkles,
  Wand2,
  GraduationCap,
  ClipboardCheck,
  Users,
  Telescope,
} from "lucide-react";
import {
  AuroraBackground,
  CinematicShell,
  FlickerBadge,
  MetallicDivider,
} from "@/components/cinematic";

export default function Landing() {
  return (
    <CinematicShell>
      <section className="relative flex-1 flex items-center justify-center overflow-hidden">
        <AuroraBackground />
        <div className="container mx-auto px-6 py-20 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center relative z-10">
          <div className="space-y-8">
            <FlickerBadge>MyLawAcad</FlickerBadge>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="font-display text-5xl md:text-7xl font-bold leading-[1.02] tracking-tight"
            >
              <span className="block">One cinematic theatre</span>
              <span className="block text-aurora text-glow">for every assessment</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.7 }}
              className="text-lg md:text-xl text-muted-foreground max-w-xl"
            >
              MyLawAcad unites two complete pathways under one roof —
              <span className="text-white"> Virtual Exam Hall</span> for AI-proctored
              live exams, and <span className="text-white">Assessment Studio</span>{" "}
              for AI-marked, taxonomy-driven assessments built by educators.
            </motion.p>

            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.25em] text-muted-foreground">
              <Feature icon={<Wand2 className="h-3.5 w-3.5" />}>
                AI Blueprint Designer
              </Feature>
              <Feature icon={<ShieldCheck className="h-3.5 w-3.5" />}>
                Multi-vector Proctor
              </Feature>
              <Feature icon={<Brain className="h-3.5 w-3.5" />}>
                Trust-scored Grading
              </Feature>
              <Feature icon={<Telescope className="h-3.5 w-3.5" />}>
                Bloom · Miller · SOLO · DOK
              </Feature>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <RoleCard
              href="/examiner"
              eyebrow="Exam Hall · Architect"
              title="Build an Exam"
              description="Compose live exams. AI drafts blueprints, proctor watches every breath."
              gradient="from-fuchsia-500/20 via-purple-500/15 to-indigo-500/10"
              accent="text-fuchsia-300"
              cta="Open Exam Hall"
              icon={<Wand2 className="h-5 w-5" />}
              testId="link-examiner"
            />
            <RoleCard
              href="/candidate"
              eyebrow="Exam Hall · Performer"
              title="Take an Exam"
              description="Enter your exam code. Be briefed, timed, proctored, graded — by the AI."
              gradient="from-amber-400/20 via-orange-400/10 to-rose-500/10"
              accent="text-amber-300"
              cta="Enter the arena"
              icon={<ClipboardCheck className="h-5 w-5" />}
              testId="link-candidate"
            />
            <RoleCard
              href="/studio/login"
              eyebrow="Studio · Educator"
              title="Build an Assessment"
              description="Author AI-marked assessments with selectable taxonomies, materials and rubrics."
              gradient="from-amber-300/20 via-yellow-400/10 to-orange-500/10"
              accent="text-amber-200"
              cta="Open the Studio"
              icon={<GraduationCap className="h-5 w-5" />}
              testId="link-studio-educator"
            />
            <RoleCard
              href="/studio/join"
              eyebrow="Studio · Student"
              title="Take an Assessment"
              description="Got a join code from your teacher? Step in — earn XP, badges, climb the leaderboard."
              gradient="from-emerald-400/20 via-teal-400/10 to-cyan-500/10"
              accent="text-emerald-300"
              cta="Join the studio"
              icon={<Users className="h-5 w-5" />}
              testId="link-studio-student"
            />
          </div>
        </div>
      </section>

      <MetallicDivider />

      <section className="container mx-auto px-6 py-16 relative z-10">
        <div className="grid md:grid-cols-3 gap-6">
          <Pillar
            number="01"
            title="Architected by AI"
            body="Describe what you want assessed in a sentence. The AI proposes structure, mix of question types, time, difficulty and rules — fully editable."
          />
          <Pillar
            number="02"
            title="Proctor with teeth"
            body="Fullscreen lock, copy/paste & shortcut blocking, devtools heuristics, idle and tab-switch tracking — rolled into a single trust score."
          />
          <Pillar
            number="03"
            title="Grading that's grounded"
            body="Every answer is judged against your actual materials, rubric, or app feature list. Paraphrasing is honoured. Hallucinated answers no longer steal marks."
          />
        </div>
      </section>
    </CinematicShell>
  );
}

function Feature({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.02]">
      {icon}
      {children}
    </span>
  );
}

function RoleCard({
  href,
  eyebrow,
  title,
  description,
  gradient,
  accent,
  cta,
  icon,
  testId,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  gradient: string;
  accent: string;
  cta: string;
  icon: React.ReactNode;
  testId: string;
}) {
  return (
    <Link href={href} data-testid={testId}>
      <motion.div
        whileHover={{ y: -6, scale: 1.01 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={`group cursor-pointer relative glass-strong rounded-3xl p-6 overflow-hidden bg-gradient-to-br ${gradient} h-full`}
      >
        <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className={`flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.4em] ${accent}`}>
            {icon}
            {eyebrow}
          </div>
          <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] pt-2">
            {cta}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function Pillar({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur space-y-3">
      <div className="font-display text-amber-300/70 text-sm tracking-[0.3em]">
        — {number}
      </div>
      <h4 className="font-display text-2xl font-bold">{title}</h4>
      <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      <Sparkles className="h-4 w-4 text-fuchsia-300/60" />
    </div>
  );
}
