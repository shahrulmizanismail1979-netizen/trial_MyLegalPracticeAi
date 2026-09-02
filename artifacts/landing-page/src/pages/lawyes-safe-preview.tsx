import { useState } from "react";
import { Menu, X, Plus, Search, FileText, Briefcase, Gavel, ShieldCheck, Layers } from "lucide-react";
import { AUDIT, REPORTS, validatePublication } from "@/fixtures/lawyes-preview";
import { useRouterState, type RouterState } from "./lawyes-safe-preview/use-router-state";
import { HomeView } from "./lawyes-safe-preview/home";
import { SearchView } from "./lawyes-safe-preview/search";
import { DraftView } from "./lawyes-safe-preview/draft";
import { MatterView } from "./lawyes-safe-preview/matter";
import { PracticeView } from "./lawyes-safe-preview/practice";
import { VerificationView } from "./lawyes-safe-preview/verification";
import { SkillsView } from "./lawyes-safe-preview/skills";

export default function LawYesSafePreview() {
  const { state, updateState, navigate } = useRouterState();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (view: typeof state.view, params?: Partial<RouterState>) => {
    navigate(view, params);
    setSidebarOpen(false);
  };

  const NavButton = ({ view, icon, label, active }: { view: typeof state.view, icon: React.ReactNode, label: string, active: boolean }) => (
    <button
      onClick={() => handleNavigate(view)}
      aria-label={`${view} workspace navigation`}
      data-testid={`button-sidebar-${view}`}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-[hsl(var(--lawyes-sidebar-hover))] text-[hsl(var(--lawyes-sidebar-text))]"
          : "text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/50 hover:text-[hsl(var(--lawyes-sidebar-text))]"
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
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[hsl(var(--lawyes-sidebar))] text-[hsl(var(--lawyes-sidebar-text))] flex flex-col border-r border-[hsl(var(--lawyes-sidebar-border))] transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:shrink-0`}>
         {/* Top Logo & New Task */}
         <div className="p-4 flex flex-col gap-4">
           <div className="flex items-center justify-between">
              <button
                onClick={() => handleNavigate("home")}
                className="flex items-center gap-2 font-serif text-xl tracking-tight text-white hover:opacity-80 transition-opacity"
                data-testid="button-sidebar-home"
              >
               <span className="w-8 h-8 flex items-center justify-center bg-secondary text-secondary-foreground font-bold rounded-md">L</span>
               LAW<span className="italic text-secondary">Yes</span>
             </button>
              <button
                className="md:hidden p-1 text-[hsl(var(--lawyes-sidebar-muted))] hover:text-white"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close workspace navigation"
                data-testid="button-close-sidebar"
              >
               <X size={20} />
             </button>
           </div>

            <button
              onClick={() => handleNavigate("home")}
              className="flex items-center gap-2 w-full bg-[hsl(var(--lawyes-sidebar-hover))] hover:bg-[hsl(var(--lawyes-sidebar-border))]/80 text-white px-4 py-3 rounded-xl transition-colors font-medium text-sm border border-[hsl(var(--lawyes-sidebar-border))] shadow-sm mt-2"
              data-testid="button-new-workspace"
            >
             <Plus size={18} />
             New Workspace
           </button>
         </div>

         {/* Nav Links */}
         <nav className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar pb-24 md:pb-4">
           <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--lawyes-sidebar-muted))] mb-3 px-2">Discovery</div>
           <NavButton view="skills" icon={<Layers size={16}/>} label="Skills Registry" active={state.view === "skills"} />

           <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--lawyes-sidebar-muted))] mt-8 mb-3 px-2">Work Modes</div>
           <NavButton view="search" icon={<Search size={16}/>} label="Search Law & Cases" active={state.view === "search"} />
           <NavButton view="draft" icon={<FileText size={16}/>} label="Draft Document" active={state.view === "draft"} />
           <NavButton view="matter" icon={<Briefcase size={16}/>} label="Matter Workspace" active={state.view === "matter"} />

           <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--lawyes-sidebar-muted))] mt-8 mb-3 px-2">Knowledge Base</div>
           <NavButton view="practice" icon={<Gavel size={16}/>} label="Practice Centre" active={state.view === "practice"} />

           {/* Context awareness */}
           {(state.matterName || state.clientRef) && (
             <div className="mt-8 mx-2 p-3 bg-[hsl(var(--lawyes-sidebar-hover))] rounded-lg border border-[hsl(var(--lawyes-sidebar-border))] animate-in fade-in slide-in-from-left-2">
               <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--lawyes-sidebar-muted))] mb-1 flex items-center justify-between">
                 Local Matter
                 <Briefcase size={10} />
               </div>
               <div className="text-sm font-medium text-white line-clamp-1 truncate">{state.matterName || "Unnamed Matter"}</div>
               <div className="text-xs text-[hsl(var(--lawyes-sidebar-muted))] mt-1 truncate">{state.clientRef}</div>
             </div>
           )}
         </nav>

         {/* Footer */}
         <div className="p-4 border-t border-[hsl(var(--lawyes-sidebar-border))] flex flex-col gap-3 bg-[hsl(var(--lawyes-sidebar))]">
            <button
              onClick={() => handleNavigate("verification")}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.view === 'verification' ? 'bg-[hsl(var(--lawyes-sidebar-hover))] text-white' : 'text-[hsl(var(--lawyes-sidebar-text))]/80 hover:bg-[hsl(var(--lawyes-sidebar-hover))]/50 hover:text-white'}`}
              data-testid="button-sidebar-verification"
            >
             <ShieldCheck size={16} />
             Sources & Verification
           </button>
           <div className="flex items-center gap-2 px-3 py-1">
             <div className="w-2 h-2 rounded-full bg-secondary"></div>
             <span className="text-[11px] text-[hsl(var(--lawyes-sidebar-muted))] font-medium uppercase tracking-wider">Safe Preview Session</span>
           </div>
         </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] relative bg-background">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-border shrink-0 z-20 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-foreground focus:outline-none"
            aria-label="Open workspace navigation"
            data-testid="button-open-sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="font-serif font-medium text-foreground flex items-center gap-1">
            <span className="w-5 h-5 flex items-center justify-center bg-secondary text-secondary-foreground text-xs font-bold rounded-sm">L</span>
            LAW<span className="italic text-secondary">Yes</span>
          </div>
          <button
            onClick={() => handleNavigate("home")}
            className="p-2 -mr-2 text-foreground focus:outline-none"
            aria-label="Start new workspace"
            data-testid="button-mobile-new-workspace"
          >
            <Plus size={20} />
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

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-border bg-white/95 backdrop-blur flex items-center justify-around px-2 pb-safe">
          <button onClick={() => handleNavigate("home")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] ${state.view === 'home' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-home">
            <Plus size={18} />
            New
          </button>
          <button onClick={() => handleNavigate("search")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] ${state.view === 'search' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-search">
            <Search size={18} />
            Search
          </button>
          <button onClick={() => handleNavigate("draft")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] ${state.view === 'draft' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-draft">
            <FileText size={18} />
            Draft
          </button>
          <button onClick={() => handleNavigate("matter")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] ${state.view === 'matter' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-matter">
            <Briefcase size={18} />
            Matter
          </button>
          <button onClick={() => handleNavigate("skills")} className={`flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] ${state.view === 'skills' ? 'text-primary' : 'text-muted-foreground'}`} data-testid="button-mobile-skills">
            <Layers size={18} />
            Skills
          </button>
        </nav>
      </main>
    </div>
  );
}
