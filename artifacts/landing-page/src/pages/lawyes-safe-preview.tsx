import { useEffect, useRef, useState } from "react";
import { Menu, X, Plus, Search, FileText, Briefcase, Gavel, ShieldCheck, Layers, MessageSquare, Wrench, ChevronDown, BookOpen, Grid, CreditCard, HeartHandshake, ShieldAlert, LogIn } from "lucide-react";
import { defaultState, useRouterState, type RouterState } from "./lawyes-safe-preview/use-router-state";
import { HomeView } from "./lawyes-safe-preview/home";
import { SearchView } from "./lawyes-safe-preview/search";
import { DraftView } from "./lawyes-safe-preview/draft";
import { MatterView } from "./lawyes-safe-preview/matter";
import { PracticeView } from "./lawyes-safe-preview/practice";
import { VerificationView } from "./lawyes-safe-preview/verification";
import { SkillsView } from "./lawyes-safe-preview/skills";
import { LawYesInstallAction } from "@/components/lawyes-install-action";

function LawYesBrand({ mobile = false }: { mobile?: boolean }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}lawyes-logo.png`}
      alt="LAWYes — Your Legal Work, Solved."
      className={mobile ? "h-12 w-auto object-contain" : "h-12 w-auto object-contain"}
      data-testid={mobile ? "lawyes-mobile-logo" : "lawyes-sidebar-logo"}
    />
  );
}

export default function LawYesSafePreview() {
  const { state, updateState, navigate } = useRouterState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const openSidebarButtonRef = useRef<HTMLButtonElement>(null);
  const closeSidebarButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const syncSidebarInteractivity = () => {
      if (media.matches || sidebarOpen) {
        sidebarRef.current?.removeAttribute("inert");
      } else {
        sidebarRef.current?.setAttribute("inert", "");
      }
    };

    syncSidebarInteractivity();
    media.addEventListener("change", syncSidebarInteractivity);
    return () => media.removeEventListener("change", syncSidebarInteractivity);
  }, [sidebarOpen]);

  useEffect(() => {
    if (sidebarOpen) {
      closeSidebarButtonRef.current?.focus();
    }
  }, [sidebarOpen]);

  const closeSidebar = () => {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => openSidebarButtonRef.current?.focus());
  };

  const handleNavigate = (view: typeof state.view, params?: Partial<RouterState>) => {
    navigate(view, params);
    if (sidebarOpen) {
      closeSidebar();
    } else {
      setSidebarOpen(false);
    }
  };

  const startNewWorkspace = () => {
    handleNavigate("home", defaultState);
  };

  const NavButton = ({ view, icon, label, active }: { view: typeof state.view, icon: React.ReactNode, label: string, active: boolean }) => (
    <button
      onClick={() => handleNavigate(view)}
      aria-label={`${view} workspace navigation`}
      data-testid={`button-sidebar-${view}`}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
        active
          ? "bg-[hsl(var(--lawyes-sidebar-hover))] text-[hsl(var(--lawyes-sidebar-text))] shadow-sm scale-[1.01]"
          : "text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] hover:scale-[1.01] active:scale-[0.99]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="safe-preview font-sans bg-background text-foreground h-[100dvh] flex overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 animate-in fade-in duration-200"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
       <aside ref={sidebarRef} data-testid="lawyes-conversation-rail" className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-[hsl(var(--lawyes-sidebar))] text-[hsl(var(--lawyes-sidebar-text))] flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:shrink-0 border-r border-[hsl(var(--lawyes-sidebar-border))]`}>
         {/* Top Logo & New Task */}
         <div className="p-3 flex items-center justify-between">
           <button
             onClick={() => handleNavigate("home")}
              className="flex items-center rounded-lg border border-[hsl(var(--lawyes-sidebar-border))] bg-white px-3 py-2 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
             data-testid="button-sidebar-home"
             aria-label="LAWYes home — Your Legal Work, Solved."
           >
             <LawYesBrand />
           </button>
           <div className="flex items-center gap-1">
             <button
                onClick={startNewWorkspace}
                className="p-2 text-[hsl(var(--lawyes-sidebar-text))]/80 hover:text-[hsl(var(--lawyes-sidebar-text))] hover:bg-[hsl(var(--lawyes-sidebar-hover))] rounded-lg transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
                aria-label="Start a new workspace"
                title="Start a new workspace"
               data-testid="button-new-workspace"
             >
               <Plus size={18} />
             </button>
             <button
                ref={closeSidebarButtonRef}
               className="md:hidden p-2 text-[hsl(var(--lawyes-sidebar-text))]/80 hover:text-[hsl(var(--lawyes-sidebar-text))] hover:bg-[hsl(var(--lawyes-sidebar-hover))] rounded-lg transition-all duration-200 active:scale-[0.95]"
                onClick={closeSidebar}
               aria-label="Close workspace navigation"
               data-testid="button-close-sidebar"
             >
               <X size={18} />
             </button>
           </div>
         </div>

         {/* Conversation rail */}
         <nav className="flex-1 overflow-y-auto p-3 no-scrollbar pb-24 md:pb-4 mt-2">
            <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--lawyes-sidebar-muted))]">Today</div>
            <button
              onClick={() => handleNavigate("home")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                state.view === "home"
                  ? "bg-[hsl(var(--lawyes-sidebar-hover))] text-[hsl(var(--lawyes-sidebar-text))] shadow-sm scale-[1.01]"
                  : "text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] hover:scale-[1.01] active:scale-[0.99]"
              }`}
              aria-label="Open current conversation"
            >
              <MessageSquare size={16} />
              <span className="truncate">New legal workspace</span>
            </button>

            {/* Context awareness */}
           {(state.matterName || state.clientRef) && (
              <button
                onClick={() => handleNavigate("matter")}
                className="mt-1 w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-label="Open active matter conversation"
              >
                <Briefcase size={16} className="mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{state.matterName || "Active matter"}</span>
                  {state.clientRef && <span className="block truncate text-[11px] text-[hsl(var(--lawyes-sidebar-muted))]">{state.clientRef}</span>}
                </span>
              </button>
           )}

            <div className="mt-6 border-t border-[hsl(var(--lawyes-sidebar-border))] pt-3">
              <button
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/75 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                aria-expanded={toolsOpen}
                aria-controls="lawyes-tools-menu"
                 data-testid="button-toggle-tools"
              >
                <Wrench size={16} />
                <span className="flex-1 text-left">Tools</span>
                <ChevronDown size={14} className={`transition-transform ${toolsOpen ? "rotate-180" : ""}`} />
              </button>
              <div
                id="lawyes-tools-menu"
                 data-testid="lawyes-tools-menu"
                 hidden={!toolsOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ${
                  toolsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden space-y-0.5 pt-1">
                  <NavButton view="search" icon={<Search size={16}/>} label="Search Law & Cases" active={state.view === "search"} />
                  <NavButton view="draft" icon={<FileText size={16}/>} label="Draft Document" active={state.view === "draft"} />
                  <NavButton view="matter" icon={<Briefcase size={16}/>} label="Matter Workspace" active={state.view === "matter"} />
                  <NavButton view="practice" icon={<Gavel size={16}/>} label="Practice Centre" active={state.view === "practice"} />
                  <NavButton view="skills" icon={<Layers size={16}/>} label="Browse all tools" active={state.view === "skills"} />
                </div>
              </div>
            </div>

            {/* Platform discoverability */}
            <div className="mt-6 border-t border-[hsl(var(--lawyes-sidebar-border))] pt-3">
              <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--lawyes-sidebar-muted))]">Platform</div>
              <div className="space-y-0.5">
                <a href="/mylitai/app/case-law" data-testid="link-sidebar-judgment-library" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
                  <BookOpen size={16} />
                  <span className="flex-1 text-left">Judgment Library</span>
                </a>

                <a href="/lawyes" data-testid="link-sidebar-my-matters" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
                  <Briefcase size={16} />
                  <span className="flex-1 text-left">My Matters</span>
                </a>

                <a href="/apps" data-testid="link-sidebar-specialist-portals" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
                  <Grid size={16} />
                  <span className="flex-1 text-left">Specialist Portals</span>
                </a>

                <a href="/apps#pricing" data-testid="link-sidebar-pricing" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
                  <CreditCard size={16} />
                  <span className="flex-1 text-left">Pricing & Access</span>
                </a>

                <a href="/contribute" data-testid="link-sidebar-contribute" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
                  <HeartHandshake size={16} />
                  <span className="flex-1 text-left">Contribute</span>
                </a>

                <a href="/apps#about" data-testid="link-sidebar-trust-security" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
                  <ShieldAlert size={16} />
                  <span className="flex-1 text-left">Trust & Security</span>
                </a>
              </div>
            </div>
         </nav>

         {/* Footer */}
         <div className="p-3 border-t border-[hsl(var(--lawyes-sidebar-border))] space-y-1">
             <LawYesInstallAction />
            <a href="/sign-in" data-testid="link-sidebar-sign-in" className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] transition-all duration-200">
              <LogIn size={16} />
              Sign in to LAWYes
            </a>
            <button
              onClick={() => handleNavigate("verification")}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${state.view === 'verification' ? 'bg-[hsl(var(--lawyes-sidebar-hover))] text-[hsl(var(--lawyes-sidebar-text))] shadow-sm scale-[1.01]' : 'text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/70 hover:text-[hsl(var(--lawyes-sidebar-text))] hover:scale-[1.01] active:scale-[0.99]'}`}
              data-testid="button-sidebar-verification"
            >
             <ShieldCheck size={16} />
              Sources & safeguards
           </button>
         </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] relative bg-background">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0 z-20 shadow-sm">
          <button
            ref={openSidebarButtonRef}
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-foreground focus:outline-none hover:bg-muted rounded-lg transition-colors"
            aria-label="Open workspace navigation"
            data-testid="button-open-sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center" aria-label="LAWYes — Your Legal Work, Solved.">
            <LawYesBrand mobile />
          </div>
          <button
             onClick={startNewWorkspace}
            className="p-2 text-foreground focus:outline-none hover:bg-muted rounded-lg transition-colors"
            aria-label="Start new workspace"
            data-testid="button-mobile-new-workspace"
          >
            <MessageSquare size={20} />
          </button>
        </header>

        {/* Views Container */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {state.view === "home" && <HomeView state={state} navigate={handleNavigate} />}
          {state.view === "search" && <SearchView state={state} updateState={updateState} />}
          {state.view === "draft" && <DraftView state={state} updateState={updateState} navigate={handleNavigate} />}
          {state.view === "matter" && <MatterView state={state} updateState={updateState} navigate={handleNavigate} />}
          {state.view === "practice" && <PracticeView state={state} updateState={updateState} navigate={handleNavigate} />}
          {state.view === "skills" && <SkillsView state={state} navigate={handleNavigate} />}
          {state.view === "verification" && <VerificationView navigate={handleNavigate} />}
        </div>

        {/* Keeping Mobile Bottom Nav for progressive disclosure, but make it very clean */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-[calc(60px+env(safe-area-inset-bottom))] border-t border-border bg-card/90 backdrop-blur-md flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
          <button onClick={() => handleNavigate("home")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${state.view === 'home' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-home">
            <MessageSquare size={20} />
            Chat
          </button>
          <button onClick={() => handleNavigate("search")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${state.view === 'search' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-search">
            <Search size={20} />
            Search
          </button>
          <button onClick={() => handleNavigate("draft")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${state.view === 'draft' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-draft">
            <FileText size={20} />
            Draft
          </button>
          <button onClick={() => handleNavigate("matter")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors ${state.view === 'matter' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-matter">
            <Briefcase size={20} />
            Matter
          </button>
        </nav>
      </main>
    </div>
  );
}
