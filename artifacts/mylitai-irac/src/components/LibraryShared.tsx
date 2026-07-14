import React from "react";
import { Link } from "wouter";
import { ChevronLeft, Search, Library as LibraryIcon } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/** Page-level header used across all library sections. */
export function LibraryHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-10 text-center max-w-3xl mx-auto">
      {eyebrow && (
        <p className="text-[11px] tracking-[0.3em] uppercase text-[hsl(var(--gold))] font-sans mb-3">
          {eyebrow}
        </p>
      )}
      <h1 className="text-3xl md:text-5xl font-serif font-bold text-[hsl(40_42%_96%)] mb-5 leading-tight flex items-center justify-center gap-3">
        {Icon && <Icon className="w-8 h-8 text-[hsl(var(--gold-bright))]" />}
        <span>{title}</span>
      </h1>
      <div className="rule-gold w-32 mx-auto mb-5" />
      {description && (
        <p className="text-base text-muted-foreground leading-relaxed font-sans">
          {description}
        </p>
      )}
    </div>
  );
}

/** A link back to a previous library route. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-[hsl(var(--gold-bright))] transition-colors mb-8"
    >
      <ChevronLeft className="w-4 h-4" />
      {label}
    </Link>
  );
}

/** A search input matching the premium dark theme. */
export function LibrarySearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="relative max-w-xl mx-auto mb-10">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("lib.searchDefault")}
        className="w-full h-12 pl-12 pr-4 rounded-full bg-card border border-card-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--gold))]/60 focus:ring-1 focus:ring-[hsl(var(--gold))]/40 transition-colors font-sans"
      />
    </div>
  );
}

/** Small gold chip / badge. */
export function Chip({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "gold" | "mono";
  className?: string;
}) {
  const base =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border";
  const styles =
    variant === "gold"
      ? "bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold-bright))] border-[hsl(var(--gold))]/30"
      : variant === "mono"
        ? "bg-white/[0.03] text-muted-foreground border-card-border font-mono"
        : "bg-white/[0.03] text-foreground/80 border-card-border";
  return <span className={`${base} ${styles} ${className}`}>{children}</span>;
}

export function LibraryLoading({ label }: { label?: string }) {
  const { t } = useLanguage();
  return (
    <div className="py-24 text-center text-[hsl(var(--gold))] animate-pulse font-serif text-lg">
      {label ?? t("common.loading")}
    </div>
  );
}

export function LibraryEmpty({
  message,
  icon: Icon = LibraryIcon,
}: {
  message: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="py-20 text-center text-muted-foreground border border-dashed border-card-border rounded-2xl">
      <Icon className="w-12 h-12 mx-auto mb-4 opacity-30" />
      <p className="text-lg font-serif">{message}</p>
    </div>
  );
}

export function LibraryError({ message }: { message?: string }) {
  const { t } = useLanguage();
  return (
    <div className="py-20 text-center text-destructive border border-dashed border-destructive/30 rounded-2xl">
      <p className="text-lg font-serif">{message ?? t("lib.error.default")}</p>
      <p className="text-sm text-muted-foreground mt-2">{t("lib.error.tryLater")}</p>
    </div>
  );
}
