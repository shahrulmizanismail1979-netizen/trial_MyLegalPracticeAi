import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AUDIT, REPORTS, validatePublication } from "@/fixtures/lawyes-preview";
import { useRouterState, type RouterState } from "./lawyes-safe-preview/use-router-state";
import { HomeView } from "./lawyes-safe-preview/home";
import { SearchView } from "./lawyes-safe-preview/search";
import { DraftView } from "./lawyes-safe-preview/draft";
import { MatterView } from "./lawyes-safe-preview/matter";
import { PracticeView } from "./lawyes-safe-preview/practice";
import { VerificationView } from "./lawyes-safe-preview/verification";
import { Home, Search as SearchIcon, FileText, Briefcase } from "lucide-react";

export default function LawYesSafePreview() {
  const { state, updateState, navigate } = useRouterState();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleNavigate = (view: typeof state.view, params?: Partial<RouterState>) => {
    navigate(view, params);
    setMobileNavOpen(false);
  };

  const NavButton = ({ view, label }: { view: typeof state.view, label: string }) => {
    const isActive = state.view === view;
    return (
      <button
        onClick={() => handleNavigate(view)}
        className={`text-sm font-medium hover:text-primary transition-colors ${isActive ? "text-primary border-b-2 border-primary pb-1" : "text-foreground/80"}`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="safe-preview font-sans bg-background text-foreground min-h-[100dvh] flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-border bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => handleNavigate("home")} className="text-xl font-bold text-foreground flex items-center gap-1 hover:opacity-80 transition-opacity">
            <span className="bg-primary text-white w-8 h-8 flex items-center justify-center font-serif text-lg leading-none">L</span>
            LAW<span className="text-secondary font-serif italic">Yes</span>
          </button>
          <div className="h-5 w-px bg-border mx-2"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Safe Preview</span>
        </div>
        <nav className="flex items-center gap-6">
          <NavButton view="search" label="Search" />
          <NavButton view="draft" label="Draft" />
          <NavButton view="matter" label="Matter" />
          <NavButton view="practice" label="Practice Centre" />
          <button onClick={() => handleNavigate("verification")} className={`text-[11px] uppercase tracking-wider font-bold hover:text-primary transition-colors ${state.view === "verification" ? "text-primary" : "text-muted-foreground"}`}>Sources &amp; Verification</button>
        </nav>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-border bg-white sticky top-0 z-50">
        <button onClick={() => handleNavigate("home")} className="text-lg font-bold text-foreground flex items-center gap-1">
          <span className="bg-primary text-white w-7 h-7 flex items-center justify-center font-serif text-base leading-none">L</span>
          LAW<span className="text-secondary font-serif italic">Yes</span>
        </button>
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-2 -mr-2 text-foreground"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav-menu"
          aria-label="Toggle navigation menu"
        >
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileNavOpen && (
        <div id="mobile-nav-menu" className="md:hidden fixed inset-0 top-[61px] bg-white z-40 p-5 flex flex-col gap-4 border-b border-border shadow-lg overflow-y-auto">
          <button onClick={() => handleNavigate("home")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Home</button>
          <button onClick={() => handleNavigate("search")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Search Law &amp; Cases</button>
          <button onClick={() => handleNavigate("draft")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Draft a Legal Document</button>
          <button onClick={() => handleNavigate("matter")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Work on a Matter</button>
          <button onClick={() => handleNavigate("practice")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Sarawak Practice Centre</button>
          <button onClick={() => handleNavigate("verification")} className="text-left text-sm font-bold uppercase tracking-wider text-muted-foreground p-3 hover:bg-background mt-4">Sources &amp; Verification</button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col pb-16 md:pb-0 relative">
        {state.view === "home" && <HomeView state={state} navigate={handleNavigate} />}
        {state.view === "search" && <SearchView state={state} updateState={updateState} />}
        {state.view === "draft" && <DraftView state={state} updateState={updateState} navigate={handleNavigate} />}
        {state.view === "matter" && <MatterView state={state} updateState={updateState} navigate={handleNavigate} />}
        {state.view === "practice" && <PracticeView state={state} updateState={updateState} navigate={handleNavigate} />}
        {state.view === "verification" && <VerificationView navigate={handleNavigate} />}
      </main>

      {/* Mobile Sticky Bottom Navigation (Exactly 4 items) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-center h-16 z-50 px-2 pb-safe">
        <button onClick={() => handleNavigate("home")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${state.view === "home" ? "text-primary" : "text-muted-foreground"}`}>
          <Home size={20} strokeWidth={state.view === "home" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => handleNavigate("search")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${state.view === "search" ? "text-primary" : "text-muted-foreground"}`}>
          <SearchIcon size={20} strokeWidth={state.view === "search" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Search</span>
        </button>
        <button onClick={() => handleNavigate("draft")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${state.view === "draft" ? "text-primary" : "text-muted-foreground"}`}>
          <FileText size={20} strokeWidth={state.view === "draft" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Draft</span>
        </button>
        <button onClick={() => handleNavigate("matter")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${state.view === "matter" ? "text-primary" : "text-muted-foreground"}`}>
          <Briefcase size={20} strokeWidth={state.view === "matter" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Matter</span>
        </button>
      </nav>

      {/* Desktop Footer */}
      <footer className="hidden md:block py-6 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto shrink-0 z-40">
        LAWYes Safe Preview &middot; Sarawak practitioner pathway &middot; Fixture audit {AUDIT.reviewedOn} &middot; Publication gate {REPORTS.every(validatePublication) ? "passed" : "failed"}
      </footer>
    </div>
  );
}