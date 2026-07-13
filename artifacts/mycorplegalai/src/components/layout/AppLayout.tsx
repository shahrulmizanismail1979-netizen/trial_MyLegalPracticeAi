import { useEffect, useCallback, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Book, FileText, FileSignature, Scale, Calculator, BookOpen,
  LogOut, BrainCircuit, ScrollText, Building2, FileSearch,
  Shield, Landmark, Receipt, CalendarClock, PenTool, Users,
  AlertTriangle, Gavel, FileText as FileTextAlt, TrendingUp,
  Briefcase, Globe, Swords, FileCheck, Handshake, Building,
  Drama, UserRoundSearch, Mic, GraduationCap, Presentation, Lock, Sparkles,
  Menu, X
} from "lucide-react";
import { AiToolsPanel } from "../ai-tools/AiToolsPanel";
import { useAiContext } from "@/contexts/AiContext";
import { useTier, setStoredTier, clearStoredTier, canAccessTool } from "@/lib/tier";

const API_BASE = import.meta.env.VITE_API_URL || "";

const TIER_LABELS: Record<string, string> = {
  legacy_full: "Full Access",
  firm: "Firm",
  practitioner: "Practitioner",
  student: "Student",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const tier = useTier();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { setPanelOpen } = useAiContext();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location]);

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLocation("/login");
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/corp/legal/validate-session`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.valid) {
        localStorage.removeItem("auth_token");
        clearStoredTier();
        alert("Your session has been terminated. Another device has signed in with this access code, or your code has been revoked.");
        setLocation("/login");
      } else if (data.tier) {
        setStoredTier(data.tier);
      }
    } catch {}
  }, [setLocation]);

  useEffect(() => {
    validateSession();
    intervalRef.current = setInterval(validateSession, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [validateSession]);

  const handleLogout = async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        await fetch(`${API_BASE}/api/corp/legal/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    localStorage.removeItem("auth_token");
    clearStoredTier();
    setLocation("/login");
  };

  const navSections = [
    { href: "/dashboard", label: "Dashboard", icon: Book },
  ];

  const librarySections = [
    { href: "/section/substantive-law", label: "Substantive Law", icon: BookOpen },
    { href: "/section/corporate-workflows", label: "Workflows", icon: FileText },
    { href: "/section/forms-drafting", label: "Forms & Drafting", icon: FileSignature },
    { href: "/section/leading-cases", label: "Leading Cases", icon: Scale },
    { href: "/section/fees-compliance", label: "Fees & Compliance", icon: Calculator },
    { href: "/section/glossary", label: "Terminology", icon: Book },
  ];

  const toolsSections = [
    { href: "/tools", label: "All Tools", icon: BrainCircuit },
  ];

  const toolGroups = [
    {
      label: "Transactional",
      items: [
        { href: "/tools/legal-opinion", label: "Legal Opinion", icon: ScrollText },
        { href: "/tools/transaction-advisor", label: "Deal Structure", icon: Building2 },
        { href: "/tools/dd-report", label: "DD Report", icon: FileSearch },
        { href: "/tools/spa-reviewer", label: "SPA Review", icon: FileTextAlt },
        { href: "/tools/contract-review", label: "Contract Review", icon: FileCheck },
        { href: "/tools/negotiation-points", label: "Negotiation", icon: Handshake },
      ],
    },
    {
      label: "Compliance",
      items: [
        { href: "/tools/macc-17a", label: "S.17A MACC", icon: Shield },
        { href: "/tools/ssm-filing", label: "SSM Filing", icon: Landmark },
        { href: "/tools/stamp-duty", label: "Stamp Duty", icon: Receipt },
        { href: "/tools/compliance-calendar", label: "Compliance Calendar", icon: CalendarClock },
        { href: "/tools/aml-checker", label: "AML Check", icon: AlertTriangle },
        { href: "/tools/corporate-secretary", label: "CoSec Advisor", icon: BookOpen },
      ],
    },
    {
      label: "Drafting",
      items: [
        { href: "/tools/board-resolution", label: "Resolutions", icon: Gavel },
        { href: "/tools/sha-builder", label: "SHA Builder", icon: Users },
        { href: "/tools/client-letter", label: "Client Letter", icon: PenTool },
      ],
    },
    {
      label: "Specialized",
      items: [
        { href: "/tools/ipo-readiness", label: "IPO Readiness", icon: TrendingUp },
        { href: "/tools/employment-advisor", label: "Employment Law", icon: Briefcase },
        { href: "/tools/cross-border", label: "Cross-Border", icon: Globe },
        { href: "/tools/dispute-resolution", label: "Disputes", icon: Swords },
        { href: "/tools/islamic-finance", label: "Islamic Finance", icon: Building },
      ],
    },
    {
      label: "Practice Simulators",
      items: [
        { href: "/tools/negotiation-simulator", label: "Negotiation Sim", icon: Drama },
        { href: "/tools/mediation-simulator", label: "Mediation Sim", icon: UserRoundSearch },
        { href: "/tools/arbitration-simulator", label: "Arbitration Sim", icon: Mic },
        { href: "/tools/client-consultation-trainer", label: "Client Trainer", icon: GraduationCap },
        { href: "/tools/board-presentation-simulator", label: "Board Sim", icon: Presentation },
      ],
    },
  ];

  const isActive = (href: string) => location === href;

  const renderNavItem = (item: { href: string; label: string; icon: React.ElementType }) => {
    const toolId = item.href.startsWith("/tools/") ? item.href.slice("/tools/".length) : null;
    const locked = toolId ? !canAccessTool(tier, toolId) : false;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-[12px] font-medium ${
          isActive(item.href)
            ? "bg-purple-500/15 text-primary border border-purple-500/20"
            : locked
            ? "text-muted-foreground/50 hover:bg-purple-500/5 hover:text-muted-foreground"
            : "text-sidebar-foreground hover:bg-purple-500/5 hover:text-sidebar-accent-foreground"
        }`}
      >
        <item.icon className={`w-3.5 h-3.5 shrink-0 ${isActive(item.href) ? "text-primary" : "text-muted-foreground"}`} />
        <span className="truncate">{item.label}</span>
        {locked && <Lock className="w-3 h-3 shrink-0 ml-auto text-muted-foreground/50" />}
      </Link>
    );
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans text-foreground">
      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`w-60 border-r border-border bg-sidebar flex flex-col shrink-0 fixed inset-y-0 left-0 z-40 transform transition-[transform,visibility] duration-200 ease-in-out md:relative md:translate-x-0 md:z-20 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full invisible md:visible"
        }`}
        aria-hidden={
          !mobileNavOpen &&
          typeof window !== "undefined" &&
          !window.matchMedia("(min-width: 768px)").matches
            ? true
            : undefined
        }
      >
        <div className="h-14 flex items-center px-5 border-b border-border shrink-0 gold-purple-gradient">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            <span className="font-serif font-bold text-base text-primary truncate">MYCorpLegalAI</span>
          </Link>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="ml-auto md:hidden text-muted-foreground hover:text-primary p-1"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-3 scrollbar-thin">
          <nav className="space-y-0.5 px-2">
            {navSections.map(renderNavItem)}
          </nav>

          <div className="px-4">
            <div className="text-[10px] font-semibold text-purple-300/60 uppercase tracking-wider mb-1.5">
              Reference Library
            </div>
          </div>
          <nav className="space-y-0.5 px-2 -mt-1">
            {librarySections.map(renderNavItem)}
          </nav>

          <div className="px-4">
            <div className="text-[10px] font-semibold text-purple-300/60 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BrainCircuit className="w-3 h-3 text-primary" />
              AI Practice Tools
            </div>
          </div>
          <nav className="space-y-0.5 px-2 -mt-1">
            {toolsSections.map(renderNavItem)}
          </nav>

          {toolGroups.map((group) => (
            <div key={group.label}>
              <div className="px-4 mb-1">
                <div className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider pl-1">
                  {group.label}
                </div>
              </div>
              <nav className="space-y-0.5 px-2">
                {group.items.map(renderNavItem)}
              </nav>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] text-muted-foreground">Plan</span>
            <span className="text-[10px] font-semibold text-primary bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
              {TIER_LABELS[tier] ?? tier}
            </span>
          </div>
          {tier !== "legacy_full" && tier !== "firm" && (
            <Link
              href="/pricing"
              className="flex w-full items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-primary rounded-md border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Upgrade Plan
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[12px] font-medium text-muted-foreground rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-[500px] purple-glow pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-full h-[300px] purple-glow-bottom pointer-events-none -z-10" />

        {/* Mobile top bar */}
        <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-sidebar shrink-0 md:hidden z-10">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="text-muted-foreground hover:text-primary p-1 -ml-1"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <Scale className="w-4 h-4 text-primary shrink-0" />
            <span className="font-serif font-bold text-sm text-primary truncate">MYCorpLegalAI</span>
          </Link>
          <button
            onClick={() => setPanelOpen(true)}
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-primary rounded-md border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-colors"
            aria-label="Open AI assistants"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            AI
          </button>
        </header>

        <div className="flex-1 overflow-y-auto z-10">
          <div className="max-w-5xl mx-auto p-4 md:p-6">
            {children}
          </div>
        </div>
      </main>

      <AiToolsPanel />
    </div>
  );
}
