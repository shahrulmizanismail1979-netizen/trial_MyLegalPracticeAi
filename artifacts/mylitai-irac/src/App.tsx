import { Switch, Route, Router as WouterRouter, Link, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { RateLimitBanner } from "@/lib/rate-limit-monitor";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Scale, FileText, PenTool, Library as LibraryIcon, BookOpen, ScanSearch, Crown, AudioLines, Gavel, FolderLock, FolderKanban, FileSignature, GitBranch, Mic, FolderOpen, CalendarClock, MessagesSquare, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import NotFound from "@/pages/not-found";
import { MatterProvider } from "@/contexts/MatterContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { AIProviderProvider } from "@/contexts/AIProviderContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AIProviderSwitcher } from "@/components/AIProviderSwitcher";
import Home from "@/pages/Home";
import Matter from "@/pages/Matter";
import Analyzer from "@/pages/Analyzer";
import Drafting from "@/pages/Drafting";
import Chat from "@/pages/Chat";
import Reply from "@/pages/Reply";
import Transcription from "@/pages/Transcription";
import Library from "@/pages/Library";
import Enforcement from "@/pages/Enforcement";
import Affidavits from "@/pages/Affidavits";
import Appeals from "@/pages/Appeals";
import OralPractice from "@/pages/OralPractice";
import Bundles from "@/pages/Bundles";
import BundleDetail from "@/pages/BundleDetail";
import Diary from "@/pages/Diary";
import Matters from "@/pages/Matters";
import MatterFile from "@/pages/MatterFile";
import Admin from "@/pages/Admin";
import ClientVault from "@/pages/ClientVault";
import LibraryTheory, { LibraryTheoryDetail } from "@/pages/LibraryTheory";
import LibraryCases, { LibraryCaseDetail } from "@/pages/LibraryCases";
import LibraryWorkflows, { LibraryWorkflowDetail } from "@/pages/LibraryWorkflows";
import LibraryForms, { LibraryFormDetail } from "@/pages/LibraryForms";
import LibraryCosts from "@/pages/LibraryCosts";
import LibraryQuantum from "@/pages/LibraryQuantum";
import LibraryGlossary from "@/pages/LibraryGlossary";
import LibraryPracticeDirections from "@/pages/LibraryPracticeDirections";
import LibraryBarCouncil from "@/pages/LibraryBarCouncil";
import CaseLaw from "@/pages/CaseLaw";
import Login from "@/pages/Login";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { vaultVerify, vaultLogout } from "@/lib/irac-api";
import { LogOut } from "lucide-react";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "login" | "ok">("checking");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ms_ticket")) {
      // Actively completing a Microsoft sign-in — let the Login page handle it.
      setPhase("login");
      return;
    }
    let live = true;
    vaultVerify()
      .then((ok) => {
        if (!live) return;
        if (ok && params.get("ms_error")) {
          // Already signed in; drop the stale error param instead of blocking.
          history.replaceState(null, "", window.location.pathname);
        }
        setPhase(ok ? "ok" : "login");
      })
      .catch(() => live && setPhase("login"));
    return () => {
      live = false;
    };
  }, []);

  if (phase === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading...
      </div>
    );
  }

  if (phase === "login") {
    return <Login onSuccess={() => setPhase("ok")} />;
  }

  return <>{children}</>;
}

function Navbar() {
  const [location] = useLocation();
  const { t } = useLanguage();

  const isActiveHref = (href: string) =>
    href === "/"
      ? location === "/"
      : location === href || location.startsWith(href + "/");

  const primaryLinks = [
    { href: "/", label: t("nav.chambers"), icon: Scale },
    { href: "/matter", label: t("nav.activeMatter"), icon: FileText },
    { href: "/analyzer", label: t("nav.analyzer"), icon: ScanSearch },
  ];

  const groups = [
    {
      label: t("nav.group.drafting"),
      icon: PenTool,
      items: [
        { href: "/drafting", label: t("nav.draftingStudio"), icon: PenTool },
        { href: "/affidavits", label: t("nav.affidavits"), icon: FileSignature },
        { href: "/appeals", label: t("nav.appeals"), icon: GitBranch },
        { href: "/enforcement", label: t("nav.enforcement"), icon: Gavel },
      ],
    },
    {
      label: t("nav.group.practice"),
      icon: Mic,
      items: [
        { href: "/chat", label: t("nav.chat"), icon: MessagesSquare },
        { href: "/transcription", label: t("nav.transcription"), icon: AudioLines },
        { href: "/oral", label: t("nav.oral"), icon: Mic },
      ],
    },
    {
      label: t("nav.group.caseFiles"),
      icon: FolderOpen,
      items: [
        { href: "/matters", label: t("nav.matters"), icon: FolderKanban },
        { href: "/bundles", label: t("nav.bundles"), icon: FolderOpen },
        { href: "/diary", label: t("nav.diary"), icon: CalendarClock },
        { href: "/vault", label: t("nav.vault"), icon: FolderLock },
      ],
    },
  ];

  const trailingLinks = [
    { href: "/library", label: t("nav.library"), icon: LibraryIcon },
    { href: "/case-law", label: "Case Law", icon: BookOpen },
  ];

  const topLinkClass = (active: boolean) =>
    `relative flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--gold-bright))]/70 ${
      active
        ? "text-[hsl(var(--gold-bright))] bg-white/5"
        : "text-[hsl(40_30%_82%)] hover:text-white hover:bg-white/5"
    }`;

  return (
    <nav className="surface-oxford sticky top-0 z-50 shadow-lg shadow-[hsl(var(--oxford-deep))]/30">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-md bg-[hsl(var(--gold))]/15 ring-1 ring-[hsl(var(--gold))]/40">
            <Scale className="w-5 h-5 text-[hsl(var(--gold-bright))]" />
          </span>
          <span className="font-serif font-bold text-lg md:text-xl text-[hsl(40_40%_95%)] tracking-wide">
            MyLitigation<span className="text-gradient-gold">Practice</span>AI
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const active = isActiveHref(link.href);
            return (
              <Link key={link.href} href={link.href} className={topLinkClass(active)} title={link.label}>
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{link.label}</span>
                {active && (
                  <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-[hsl(var(--gold-bright))]" />
                )}
              </Link>
            );
          })}

          {groups.map((groupItem) => {
            const GroupIcon = groupItem.icon;
            const active = groupItem.items.some((i) => isActiveHref(i.href));
            return (
              <DropdownMenu key={groupItem.label}>
                <DropdownMenuTrigger className={topLinkClass(active)} title={groupItem.label} aria-label={groupItem.label}>
                  <GroupIcon className="w-4 h-4" />
                  <span className="hidden lg:inline">{groupItem.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                  {active && (
                    <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-[hsl(var(--gold-bright))]" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                  {groupItem.items.map((item) => {
                    const ItemIcon = item.icon;
                    const itemActive = isActiveHref(item.href);
                    return (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2.5 cursor-pointer ${
                            itemActive ? "text-[hsl(var(--gold-bright))]" : ""
                          }`}
                        >
                          <ItemIcon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}

          {trailingLinks.map((link) => {
            const Icon = link.icon;
            const active = isActiveHref(link.href);
            return (
              <Link key={link.href} href={link.href} className={topLinkClass(active)} title={link.label} aria-label={link.label}>
                <Icon className="w-4 h-4" />
                <span className="hidden 2xl:inline">{link.label}</span>
                {active && (
                  <span className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-[hsl(var(--gold-bright))]" />
                )}
              </Link>
            );
          })}

          <AIProviderSwitcher className="ml-1" />
          <LanguageSwitcher className="ml-1" />
          <button
            type="button"
            onClick={async () => {
              const ok = await vaultLogout();
              if (!ok) {
                alert(t("common.errorRetry"));
                return;
              }
              window.location.assign(import.meta.env.BASE_URL || "/");
            }}
            className="ml-1 flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t("nav.logout")}
            aria-label={t("nav.logout")}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden lg:inline">{t("nav.logout")}</span>
          </button>
        </div>
      </div>
      <div className="rule-gold" />
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login">
          <Redirect to="/" />
        </Route>
        <Route path="/" component={Home} />
        <Route path="/matter" component={Matter} />
        <Route path="/analyzer" component={Analyzer} />
        <Route path="/drafting" component={Drafting} />
        <Route path="/chat" component={Chat} />
        <Route path="/reply" component={Reply} />
        <Route path="/transcription" component={Transcription} />
        <Route path="/enforcement" component={Enforcement} />
        <Route path="/affidavits" component={Affidavits} />
        <Route path="/appeals" component={Appeals} />
        <Route path="/oral" component={OralPractice} />
        <Route path="/bundles/:id" component={BundleDetail} />
        <Route path="/bundles" component={Bundles} />
        <Route path="/matters/:id" component={MatterFile} />
        <Route path="/matters" component={Matters} />
        <Route path="/diary" component={Diary} />
        <Route path="/admin" component={Admin} />
        <Route path="/vault" component={ClientVault} />
        <Route path="/library" component={Library} />
        <Route path="/library/theory" component={LibraryTheory} />
        <Route path="/library/theory/:id" component={LibraryTheoryDetail} />
        <Route path="/library/cases" component={LibraryCases} />
        <Route path="/library/cases/:id" component={LibraryCaseDetail} />
        <Route path="/library/workflows" component={LibraryWorkflows} />
        <Route path="/library/workflows/:id" component={LibraryWorkflowDetail} />
        <Route path="/library/forms" component={LibraryForms} />
        <Route path="/library/forms/:id" component={LibraryFormDetail} />
        <Route path="/library/costs" component={LibraryCosts} />
        <Route path="/library/quantum" component={LibraryQuantum} />
        <Route path="/library/glossary" component={LibraryGlossary} />
        <Route path="/library/practice-directions" component={LibraryPracticeDirections} />
        <Route path="/library/bar-council" component={LibraryBarCouncil} />
        <Route path="/case-law" component={CaseLaw} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AIProviderProvider>
        <MatterProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthGate>
                <Router />
              </AuthGate>
            </WouterRouter>
            <Toaster />
            <RateLimitBanner />
          </TooltipProvider>
        </MatterProvider>
        </AIProviderProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
