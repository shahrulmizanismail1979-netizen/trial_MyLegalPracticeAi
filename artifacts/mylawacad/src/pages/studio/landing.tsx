import { Link } from "wouter";
import {
  CinematicShell,
  GoldButton,
  GhostButton,
  SpotlightCard,
} from "@/components/cinematic-studio";
import {
  BookOpen,
  Shield,
  Brain,
  PenTool,
  GraduationCap,
  Users,
  ArrowRight,
  KeyRound,
  Sparkles,
  Building2,
} from "lucide-react";

export default function Landing() {
  return (
    <CinematicShell>
      <div className="container mx-auto px-6 pt-16 pb-10">
        <div className="text-center max-w-3xl mx-auto space-y-5 mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[0.65rem] uppercase tracking-[0.3em] font-bold">
            <Sparkles className="w-3 h-3" />
            Pedagogical Authoring Suite
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-glow-gold text-gold leading-[1.05]">
            Assessment Studio
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            A professional environment for serious educators to design assessments anchored in real
            pedagogical frameworks — with AI-marked rubrics, cinematic proctoring, and multi-modal
            answer capture.
          </p>
          <p className="text-sm uppercase tracking-[0.3em] text-amber-400/80 font-bold pt-2">
            Choose your path
          </p>
        </div>

        {/* Two pathways */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto"
          data-testid="pathways"
        >
          {/* Student pathway */}
          <Link href="/studio/join">
            <SpotlightCard
              className="group cursor-pointer h-full p-9 border-purple-500/30 bg-gradient-to-br from-purple-950/30 via-black/40 to-black/20 hover:border-purple-400/60 transition-all hover:-translate-y-1"
              data-testid="path-student"
            >
              <div className="flex flex-col h-full gap-5">
                <div className="flex items-center justify-between">
                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300">
                    <Users className="w-8 h-8" />
                  </div>
                  <span className="text-[0.6rem] uppercase tracking-[0.3em] text-purple-300/70 font-bold">
                    No account needed
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-3xl font-bold text-foreground mb-2">
                    I'm a Student
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Got an access code from your educator? Enter it to begin your assessment with
                    voice, text, or handwriting.
                  </p>
                </div>
                <div className="mt-auto pt-3 flex items-center gap-2 text-purple-300 font-semibold text-sm">
                  <KeyRound className="w-4 h-4" />
                  Enter access code
                  <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </SpotlightCard>
          </Link>

          {/* Educator pathway */}
          <SpotlightCard
            className="group h-full p-9 border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-black/40 to-black/20 hover:border-amber-400/60 transition-all hover:-translate-y-1"
            data-testid="path-educator"
          >
            <div className="flex flex-col h-full gap-5">
              <div className="flex items-center justify-between">
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <span className="text-[0.6rem] uppercase tracking-[0.3em] text-amber-300/70 font-bold">
                  Educator account
                </span>
              </div>
              <div>
                <h2 className="font-display text-3xl font-bold text-foreground mb-2">
                  I'm an Educator
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Author rigorous assessments, generate AI-aligned questions, run proctored exams,
                  and earn XP as you build your library.
                </p>
              </div>
              <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                <Link href="/studio/login" data-testid="educator-signin">
                  <GhostButton className="!py-2 !px-4 !text-xs">Sign In</GhostButton>
                </Link>
                <Link href="/studio/register" data-testid="educator-register">
                  <GoldButton className="!py-2 !px-4 !text-xs">
                    Create Account
                    <ArrowRight className="w-3.5 h-3.5" />
                  </GoldButton>
                </Link>
              </div>
            </div>
          </SpotlightCard>
        </div>

        {/* Virtual Exam Hall companion */}
        <div className="max-w-5xl mx-auto mt-6">
          <a href="/" data-testid="path-exam-hall">
            <SpotlightCard className="group cursor-pointer p-6 border-blue-500/20 bg-gradient-to-r from-blue-950/20 via-black/30 to-black/20 hover:border-blue-400/50 transition-colors">
              <div className="flex items-center gap-5">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.6rem] uppercase tracking-[0.3em] text-blue-300/70 font-bold mb-1">
                    Companion suite
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    Looking for the Virtual Exam Hall?
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Our original exam platform with template-based exams for examiners and
                    candidate sessions.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-300 shrink-0 group-hover:translate-x-1 transition-transform" />
              </div>
            </SpotlightCard>
          </a>
        </div>
      </div>

      {/* Feature grid */}
      <div className="container mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl font-bold text-gold">What's inside the Studio</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SpotlightCard className="flex flex-col items-start gap-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">Rigorous Frameworks</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Anchor your assessments in Bloom's Revised Taxonomy, Miller's Pyramid, SOLO Taxonomy,
              or Webb's DOK.
            </p>
            <Link
              href="/studio/frameworks"
              className="mt-auto pt-4 text-xs font-bold text-amber-400 uppercase tracking-widest hover:text-amber-300"
            >
              Explore Models →
            </Link>
          </SpotlightCard>

          <SpotlightCard className="flex flex-col items-start gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">AI-Assisted Authoring</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upload course materials and generate high-quality questions aligned with your chosen
              taxonomy levels.
            </p>
          </SpotlightCard>

          <SpotlightCard className="flex flex-col items-start gap-4">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">Cinematic Proctoring</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Enforce focus with configurable browser lockdowns, audio monitoring, and webcam
              snapshot analysis.
            </p>
          </SpotlightCard>

          <SpotlightCard className="flex flex-col items-start gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <PenTool className="w-6 h-6" />
            </div>
            <h3 className="font-display text-xl font-bold text-foreground">Multi-Modal Answers</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Let students express their knowledge through typing, voice dictation, or digital
              handwriting.
            </p>
          </SpotlightCard>
        </div>
      </div>
    </CinematicShell>
  );
}
