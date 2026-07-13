import React, { useState, useRef, useEffect } from 'react';
import {
  Menu, PanelRight, Bot, PenTool, ShieldAlert, ListChecks, Clock,
  FileSearch, GitCompare, MapPin, Receipt, ChevronDown,
  Mail, ClipboardCheck, Scale, FileQuestion, Calculator, BookOpen, X,
  Stamp, TrendingDown, Home, Gavel, AlertOctagon, Search,
  HardHat, UserX, Globe, FileCheck, Landmark, Building2,
  LogOut, User, Brain, PlayCircle, Library, FileText, CheckSquare,
  Timer, GraduationCap, Microscope,
  FileSignature, Handshake, ShieldCheck, Building, Lock, Crown, CreditCard, Loader2,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import type { AiMode } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { syncBilling, openBillingPortal } from '@/lib/subscription';
import { hasTier, requiredTierForTool, TIER_LABELS } from '@/lib/tier';
import { Sidebar } from '@/components/Sidebar';
import { AIPanel } from '@/components/AIPanel';
import { DocumentModal } from '@/components/DocumentModal';
import { TheorySection } from '@/components/sections/Theory';
import { WorkflowsSection } from '@/components/sections/Workflows';
import { FormsSection } from '@/components/sections/Forms';
import { CasesSection } from '@/components/sections/Cases';
import { CostsSection } from '@/components/sections/Costs';
import { TerminologySection } from '@/components/sections/Terminology';
import { NAV_MENU } from '@/lib/data';

const AI_TOOLS: { mode: AiMode; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  { mode: 'tutor',           label: 'AI Tutor',                 shortLabel: 'Tutor',          icon: Bot,            group: 'Learn' },
  { mode: 'caseresearch',    label: 'Case Law Research',        shortLabel: 'Case Law',       icon: BookOpen,       group: 'Learn' },
  { mode: 'drafter',         label: 'AI Drafter',               shortLabel: 'Drafter',        icon: PenTool,        group: 'Draft' },
  { mode: 'advice',          label: 'Client Advice Letter',     shortLabel: 'Advice',         icon: Mail,           group: 'Draft' },
  { mode: 'opinion',         label: 'Legal Opinion Generator',  shortLabel: 'Opinion',        icon: Scale,          group: 'Draft' },
  { mode: 'tenancy',         label: 'Tenancy Agreement Drafter',shortLabel: 'Tenancy',        icon: Home,           group: 'Draft' },
  { mode: 'poa',             label: 'Power of Attorney Drafter',shortLabel: 'POA',            icon: Gavel,          group: 'Draft' },
  { mode: 'reviewer',        label: 'SPA / Contract Reviewer',  shortLabel: 'SPA Review',     icon: FileSearch,     group: 'Review' },
  { mode: 'comparator',      label: 'Clause Comparator',        shortLabel: 'Compare',        icon: GitCompare,     group: 'Review' },
  { mode: 'title',           label: 'Land Title Interpreter',   shortLabel: 'Title',          icon: MapPin,         group: 'Review' },
  { mode: 'duediligence',    label: 'Due Diligence Report',     shortLabel: 'Due Diligence',  icon: ClipboardCheck, group: 'Review' },
  { mode: 'requisition',     label: 'Requisition Letter',       shortLabel: 'Requisition',    icon: FileQuestion,   group: 'Review' },
  { mode: 'landsearch',      label: 'Land Search Analyzer',     shortLabel: 'Land Search',    icon: Search,         group: 'Review' },
  { mode: 'loandoc',         label: 'Loan Doc Reviewer',        shortLabel: 'Loan Doc',       icon: FileCheck,      group: 'Review' },
  { mode: 'risk',            label: 'Risk Scanner',             shortLabel: 'Risks',          icon: ShieldAlert,    group: 'Practice' },
  { mode: 'checklist',       label: 'Checklist Generator',      shortLabel: 'Checklist',      icon: ListChecks,     group: 'Practice' },
  { mode: 'deadlines',       label: 'Deadline Calculator',      shortLabel: 'Deadlines',      icon: Clock,          group: 'Practice' },
  { mode: 'quotation',       label: 'Fee Quotation Generator',  shortLabel: 'Fee Quote',      icon: Receipt,        group: 'Practice' },
  { mode: 'completion',      label: 'Completion Statement',     shortLabel: 'Completion',     icon: Calculator,     group: 'Practice' },
  { mode: 'stampduty',       label: 'Stamp Duty Calculator',    shortLabel: 'Stamp Duty',     icon: Stamp,          group: 'Tax & Finance' },
  { mode: 'rpgt',            label: 'RPGT Advisor',             shortLabel: 'RPGT',           icon: TrendingDown,   group: 'Tax & Finance' },
  { mode: 'taxcompliance',   label: 'LHDN Tax Compliance',      shortLabel: 'Tax',            icon: Landmark,       group: 'Tax & Finance' },
  { mode: 'caveat',          label: 'Caveat Advisor',           shortLabel: 'Caveat',         icon: AlertOctagon,   group: 'Specialist' },
  { mode: 'devclaim',        label: 'Developer Claim Advisor',  shortLabel: 'Dev Claim',      icon: HardHat,        group: 'Specialist' },
  { mode: 'bankruptcy',      label: 'Bankruptcy Search Advisor', shortLabel: 'Bankruptcy',    icon: UserX,          group: 'Specialist' },
  { mode: 'foreignpurchase', label: 'Foreign Purchase Advisor', shortLabel: 'Foreign',        icon: Globe,          group: 'Specialist' },
  { mode: 'strata',          label: 'Strata Management Advisor',shortLabel: 'Strata',         icon: Building2,      group: 'Specialist' },
  { mode: 'quiz',             label: 'Quiz Generator',           shortLabel: 'Quiz',           icon: Brain,          group: 'Assessment' },
  { mode: 'mockexam',         label: 'Mock Exam Generator',      shortLabel: 'Mock Exam',      icon: GraduationCap,  group: 'Assessment' },
  { mode: 'caseanalyzer',     label: 'Case Law Analyzer',        shortLabel: 'Case Analysis',  icon: Microscope,     group: 'Assessment' },
  { mode: 'simulator',        label: 'Transaction Simulator',    shortLabel: 'Simulator',      icon: PlayCircle,     group: 'Automation' },
  { mode: 'clauselib',        label: 'Clause Library',           shortLabel: 'Clause Lib',     icon: Library,        group: 'Automation' },
  { mode: 'docanalyzer',      label: 'Document Analyzer',        shortLabel: 'Doc Analyzer',   icon: FileText,       group: 'Automation' },
  { mode: 'compliance',       label: 'Compliance Checker',       shortLabel: 'Compliance',     icon: CheckSquare,    group: 'Automation' },
  { mode: 'timeline',         label: 'Timeline Generator',       shortLabel: 'Timeline',       icon: Timer,          group: 'Automation' },
  { mode: 'corpresolution',  label: 'Corporate Resolution',     shortLabel: 'Resolution',     icon: FileSignature,  group: 'Corporate' },
  { mode: 'corpdd',          label: 'Corporate Property DD',    shortLabel: 'Corp DD',        icon: Building,       group: 'Corporate' },
  { mode: 'jvagreement',     label: 'JV / JDA Drafter',         shortLabel: 'JV / JDA',       icon: Handshake,      group: 'Corporate' },
  { mode: 'guarantee',       label: 'Guarantee Drafter',        shortLabel: 'Guarantee',      icon: ShieldCheck,    group: 'Corporate' },
];

export function Dashboard() {
  const [mobileMenuOpen, setMobileOpen] = useState(false);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const { activeSection, isAiPanelOpen, setIsAiPanelOpen, setAiMode, aiMode, currentUser, logout, refreshAccess } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [portalLoading, setPortalLoading] = useState(false);

  const tier = currentUser?.tier ?? 'free';
  const grandfathered = !!currentUser?.grandfathered;
  const isFirm = hasTier(tier, 'firm');
  const isPaid = !grandfathered && !!currentUser?.subscriptionStatus && tier !== 'free';

  const activeTitle = NAV_MENU.find(m => m.id === activeSection)?.title || '';
  const activeTool = AI_TOOLS.find(t => t.mode === aiMode);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolMenuRef.current && !toolMenuRef.current.contains(e.target as Node)) setToolMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Activate access immediately after returning from Stripe Checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') return;
    const sessionId = params.get('session_id');
    const clean = () => window.history.replaceState({}, '', window.location.pathname);
    (async () => {
      try {
        if (sessionId) await syncBilling(sessionId);
        await refreshAccess();
        toast({ title: 'Subscription active', description: 'Your plan is now unlocked. Enjoy!' });
        // Only clear the checkout params once activation succeeds, so a transient
        // failure leaves session_id in the URL and a refresh retries activation.
        clean();
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Payment received',
          description: 'Activation is finalising — refresh this page in a moment to unlock your plan.',
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToolClick = (mode: AiMode) => {
    const need = requiredTierForTool(mode);
    if (!hasTier(tier, need)) {
      setToolMenuOpen(false);
      toast({
        title: `${TIER_LABELS[need]} plan required`,
        description: `Upgrade to ${TIER_LABELS[need]} to use this tool.`,
      });
      navigate('/pricing');
      return;
    }
    setAiMode(mode);
    setIsAiPanelOpen(true);
    setToolMenuOpen(false);
  };

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const url = await openBillingPortal(window.location.href);
      window.location.href = url;
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not open billing',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
      setPortalLoading(false);
    }
  };

  const groups = ['Learn', 'Draft', 'Review', 'Practice', 'Tax & Finance', 'Specialist', 'Corporate', 'Assessment', 'Automation'] as const;

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-amber-500/30">
      <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileOpen} />
      
      <main className="flex-1 flex flex-col h-full relative min-w-0 bg-gold-950">
        <header className="h-20 bg-gold-950/80 backdrop-blur-md border-b border-gold-800 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 gap-4">
          <div className="flex items-center gap-4 shrink-0">
            <button 
              className="md:hidden p-2 text-slate-400 hover:text-slate-100 hover:bg-gold-800 rounded-lg transition-colors" 
              onClick={() => setMobileOpen(true)}
              data-testid="button-mobile-menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="font-serif font-semibold text-xl text-slate-200 hidden sm:block truncate max-w-xs">{activeTitle}</h2>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative" ref={toolMenuRef}>
              <button
                data-testid="button-ai-tool-selector"
                onClick={() => setToolMenuOpen(!toolMenuOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  isAiPanelOpen
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    : 'bg-gold-900 text-slate-400 border-gold-800 hover:bg-gold-800 hover:text-slate-200'
                }`}
              >
                {activeTool && <activeTool.icon className="w-4 h-4 shrink-0" />}
                <span className="hidden md:inline">{activeTool?.shortLabel || 'AI Tools'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${toolMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {toolMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-gold-900 border border-gold-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {groups.map(group => (
                    <div key={group}>
                      <div className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-gold-950/50 sticky top-0">{group}</div>
                      {AI_TOOLS.filter(t => t.group === group).map(({ mode, label, icon: Icon }) => {
                        const isActive = aiMode === mode && isAiPanelOpen;
                        const locked = !hasTier(tier, requiredTierForTool(mode));
                        return (
                          <button
                            key={mode}
                            data-testid={`button-ai-${mode}`}
                            onClick={() => handleToolClick(mode)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                              isActive
                                ? 'bg-amber-500/15 text-amber-400'
                                : locked
                                ? 'text-slate-500 hover:bg-gold-800'
                                : 'text-slate-300 hover:bg-gold-800 hover:text-slate-100'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{label}</span>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                            {!isActive && locked && <Lock className="ml-auto w-3.5 h-3.5 shrink-0 text-slate-600" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              data-testid="button-toggle-ai-panel"
              className={`p-2 rounded-lg transition-colors border ${isAiPanelOpen ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-gold-900 text-slate-400 border-gold-800 hover:bg-gold-800 hover:text-slate-200'}`}
              title="Toggle AI Panel"
            >
              <PanelRight className="w-4 h-4" />
            </button>

            {!isFirm ? (
              <button
                onClick={() => navigate('/pricing')}
                data-testid="button-upgrade"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-amber-500 text-slate-900 hover:bg-amber-400 transition-all active:scale-95"
                title="Upgrade your plan"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Upgrade</span>
              </button>
            ) : (
              <span
                data-testid="badge-tier"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/25"
                title={grandfathered ? 'Founding member — full access' : 'Firm plan'}
              >
                <Crown className="w-3.5 h-3.5" />
                {grandfathered ? 'Founder' : TIER_LABELS[tier]}
              </span>
            )}

            {isPaid && (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                data-testid="button-manage-billing"
                className="p-2 rounded-lg border bg-gold-900 text-slate-400 border-gold-800 hover:bg-gold-800 hover:text-slate-200 transition-colors disabled:opacity-50"
                title="Manage billing"
              >
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              </button>
            )}

            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-gold-800">
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
                  <User className="w-3.5 h-3.5" />
                  <span data-testid="text-current-user">{currentUser.displayName}</span>
                  {currentUser.role === 'admin' && (
                    <span className="text-[9px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-md font-bold uppercase">Admin</span>
                  )}
                </div>
                <button
                  onClick={logout}
                  data-testid="button-logout"
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-gold-800 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 lg:p-14 custom-scrollbar relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-64 bg-amber-500/5 blur-[100px] pointer-events-none rounded-full" />
          
          <div className="relative z-10">
            {activeSection === 'theory' && <TheorySection />}
            {activeSection === 'workflows' && <WorkflowsSection />}
            {activeSection === 'forms' && <FormsSection />}
            {activeSection === 'jurisprudence' && <CasesSection />}
            {activeSection === 'costs' && <CostsSection />}
            {activeSection === 'terminology' && <TerminologySection />}
          </div>
        </div>
        
        <DocumentModal />
      </main>

      <AIPanel />
    </div>
  );
}
