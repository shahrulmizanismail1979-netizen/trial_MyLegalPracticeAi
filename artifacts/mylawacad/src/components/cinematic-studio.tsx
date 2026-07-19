import { ReactNode, HTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Link, useLocation } from "wouter";
import { BookOpen, UserCircle, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <div className="min-h-screen flex flex-col text-foreground bg-background">
      {showHeader ? <CinematicHeader /> : null}
      <main className="relative flex-1 flex flex-col">{children}</main>
      {showFooter ? <CinematicFooter /> : null}
    </div>
  );
}

function CinematicHeader() {
  const [loc] = useLocation();
  const { user, logout } = useAuth();
  const isEducator = !!user;

  return (
    <header className="relative z-40 border-b border-white/5 backdrop-blur-xl bg-black/40">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href={isEducator ? "/studio/dashboard" : "/studio"}
          className="flex items-center gap-3 group"
          data-testid="link-home"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-600 shadow-lg shadow-amber-500/30">
            <BookOpen className="h-5 w-5 text-black" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-display text-lg uppercase tracking-[0.15em] text-gold">
              Assessment Studio
            </span>
            <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
              Authoring Environment
            </span>
          </div>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {!isEducator && (
            <Link href="/studio/frameworks" className="text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.1em] text-xs font-semibold">
              Frameworks
            </Link>
          )}
          {isEducator ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-white/10">
                  <UserCircle className="h-5 w-5 text-amber-400" />
                  <span className="text-sm font-medium">{user.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 glass border-gold/50">
                <div className="px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wider">
                  Signed in as
                </div>
                <div className="px-2 py-1 font-medium truncate">{user.email}</div>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/studio/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/studio/frameworks">Framework Reference</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => logout()} className="text-red-400 focus:bg-red-950/30 focus:text-red-300 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/studio/login" className="text-sm font-semibold uppercase tracking-wider hover:text-gold transition-colors">
              Educator Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function CinematicFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 bg-black/50 backdrop-blur">
      <div className="container mx-auto px-6 py-4 text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground flex items-center justify-between">
        <span>Assessment Studio</span>
        <span>Pedagogical Authoring · Cinematic Mode</span>
      </div>
    </footer>
  );
}

export function StudioBackground({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)} aria-hidden>
      <motion.div
        className="absolute -top-40 -left-40 h-[40rem] w-[40rem] rounded-full blur-[140px]"
        style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.15), transparent)" }}
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -20, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/4 -right-20 h-[36rem] w-[36rem] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(closest-side, rgba(14,165,233,0.1), transparent)" }}
        animate={{ x: [0, -30, 20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
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
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative glass rounded-2xl p-6 overflow-hidden",
        className,
      )}
      {...rest}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 hover:opacity-100"
        style={{
          background:
            "radial-gradient(600px circle at var(--mouse-x,50%) var(--mouse-y,50%), rgba(251,191,36,0.12), transparent 40%)",
        }}
      />
      {children}
    </motion.div>
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
        <div className="text-[0.65rem] uppercase tracking-[0.4em] text-amber-500/80">
          {eyebrow}
        </div>
      ) : null}
      <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight text-foreground">
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
            <div className="text-[0.65rem] uppercase tracking-[0.4em] text-amber-500/80 font-bold">
              {eyebrow}
            </div>
          ) : null}
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-[1.1] text-glow-gold text-gold">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
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
        "group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-bold uppercase tracking-[0.15em] text-xs text-black",
        "bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600",
        "shadow-[0_4px_20px_-5px_rgba(251,191,36,0.5)]",
        "transition-all duration-300 hover:shadow-[0_10px_30px_-5px_rgba(251,191,36,0.7)] hover:-translate-y-0.5",
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
        "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs tracking-wider uppercase border border-white/10 text-white/80 hover:bg-white/5 hover:text-white transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
}
