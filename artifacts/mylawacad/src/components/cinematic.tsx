import { ReactNode, HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Link, useLocation } from "wouter";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export function CinematicShell({
  children,
  showHeader = true,
  showFooter = true,
}: {
  children: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}) {
  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <div
        className="pointer-events-none fixed inset-0 grid-pattern opacity-50"
        aria-hidden
      />
      {showHeader ? <CinematicHeader /> : null}
      <main className="relative flex-1 flex flex-col">{children}</main>
      {showFooter ? <CinematicFooter /> : null}
    </div>
  );
}

function CinematicHeader() {
  const [loc] = useLocation();
  const isExaminer = loc.startsWith("/examiner") || loc.startsWith("/candidate") || loc.startsWith("/exam");
  const isStudio = loc.startsWith("/studio");
  return (
    <header className="relative z-40 border-b border-white/5 backdrop-blur-xl bg-black/30">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 group"
          data-testid="link-home"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-purple-500 to-amber-400 shadow-lg shadow-fuchsia-500/40">
            <ScrollText className="h-5 w-5 text-black" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg uppercase tracking-[0.18em] text-aurora">
              MyLawAcad
            </span>
            <span className="text-[0.65rem] uppercase tracking-[0.32em] text-muted-foreground">
              mylawacad
            </span>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <RoleBadge active={isExaminer}>Exam Hall</RoleBadge>
          <RoleBadge active={isStudio}>Studio</RoleBadge>
        </nav>
      </div>
    </header>
  );
}

function RoleBadge({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full uppercase tracking-[0.2em] text-[0.65rem] font-semibold transition-all",
        active
          ? "bg-gradient-to-r from-fuchsia-500/30 to-amber-400/30 text-white border border-white/20"
          : "text-muted-foreground border border-transparent",
      )}
    >
      {children}
    </span>
  );
}

function CinematicFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-black/40 backdrop-blur">
      <div className="container mx-auto px-6 py-4 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground flex items-center justify-between">
        <span>MyLawAcad · Exam Hall + Studio</span>
        <span>AI-Proctored · Cinematic Mode</span>
      </div>
    </footer>
  );
}

export function AuroraBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden>
      <motion.div
        className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(closest-side, rgba(192,132,252,0.45), transparent)" }}
        animate={{ x: [0, 60, -40, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -right-32 h-[36rem] w-[36rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(closest-side, rgba(244,114,182,0.4), transparent)" }}
        animate={{ x: [0, -50, 30, 0], y: [0, -40, 30, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-40 left-1/3 h-[32rem] w-[32rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.32), transparent)" }}
        animate={{ x: [0, 40, -30, 0], y: [0, -20, 40, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

export function SpotlightCard({
  children,
  className,
  ...rest
}: HTMLMotionProps<"div"> & { className?: string; children?: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative glass rounded-2xl p-8 overflow-hidden",
        className,
      )}
      {...rest}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(192,132,252,0.18), transparent 40%)",
        }}
      />
      {children}
    </motion.div>
  );
}

export function StatPill({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: ReactNode;
  accent?: "default" | "good" | "warn" | "bad";
}) {
  const accentClass = {
    default: "from-purple-500/20 to-fuchsia-500/20 text-white",
    good: "from-emerald-500/25 to-emerald-400/15 text-emerald-200",
    warn: "from-amber-500/30 to-orange-400/15 text-amber-200",
    bad: "from-rose-500/30 to-red-400/20 text-rose-200",
  }[accent];
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-gradient-to-br p-4 backdrop-blur",
        accentClass,
      )}
    >
      <div className="text-[0.65rem] uppercase tracking-[0.3em] opacity-70">
        {label}
      </div>
      <div className="text-2xl font-display tabular-nums">{value}</div>
    </div>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {eyebrow ? (
        <div className="text-[0.65rem] uppercase tracking-[0.4em] text-fuchsia-300/80">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground max-w-2xl">{description}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="container mx-auto px-6 pt-12 pb-8 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3">
          {eyebrow ? (
            <div className="text-[0.65rem] uppercase tracking-[0.4em] text-fuchsia-300/80">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] text-glow">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-lg">
              {description}
            </p>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
  );
}

export function MetallicDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-px bg-gradient-to-r from-transparent via-white/15 to-transparent",
        className,
      )}
    />
  );
}

export function FlickerBadge({
  children,
  tone = "live",
}: {
  children: ReactNode;
  tone?: "live" | "warning" | "info";
}) {
  const colors = {
    live: "bg-emerald-400 shadow-emerald-400/60",
    warning: "bg-amber-400 shadow-amber-400/60",
    info: "bg-sky-400 shadow-sky-400/60",
  }[tone];
  return (
    <span className="inline-flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.3em] text-white/80">
      <span className={cn("h-2 w-2 rounded-full animate-pulse-ring", colors)} />
      {children}
    </span>
  );
}

export function GoldButton({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLButtonElement> & {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold uppercase tracking-[0.18em] text-sm text-black",
        "bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400",
        "shadow-[0_10px_40px_-10px_rgba(251,191,36,0.7)]",
        "transition-all duration-300 hover:shadow-[0_20px_60px_-10px_rgba(251,191,36,0.9)] hover:-translate-y-0.5",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        className,
      )}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}

export function VioletButton({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLButtonElement> & {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold uppercase tracking-[0.18em] text-sm text-white",
        "bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600",
        "shadow-[0_10px_40px_-10px_rgba(192,132,252,0.7)]",
        "transition-all duration-300 hover:shadow-[0_20px_60px_-10px_rgba(192,132,252,0.95)] hover:-translate-y-0.5",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        className,
      )}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLButtonElement> & {
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm border border-white/15 text-white/85 hover:bg-white/5 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
