import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Scale, 
  BookOpen, 
  GitBranch, 
  FileText, 
  FileSignature, 
  Gavel, 
  Calculator, 
  BookA, 
  LogOut,
  Menu,
  BotMessageSquare,
  Briefcase,
  FolderOpen,
  Mic,
  Sparkles,
  FolderKanban,
  CalendarClock,
  Landmark,
  Layers,
  ShieldCheck
} from 'lucide-react';
import { Button } from './ui';
import { AITutor } from './AITutor';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const { t } = useLanguage();
  const [location] = useLocation();
  const navItems = [
    { name: t('nav.aiChambers'), path: '/app/chambers', icon: Briefcase, highlight: true },
    { name: t('nav.oralAdvocacy'), path: '/app/oral-practice', icon: Mic, highlight: true },
    { name: t('nav.matters'), path: '/app/matters', icon: FolderKanban },
    { name: t('nav.diary'), path: '/app/diary', icon: CalendarClock },
    { name: t('nav.bankingRecovery'), path: '/app/banking-recovery', icon: Landmark, highlight: true },
    { name: t('nav.enforcement'), path: '/app/enforcement', icon: Gavel, highlight: true },
    { name: t('nav.bundles'), path: '/app/bundles', icon: Layers, highlight: true },
    { name: t('nav.compliance'), path: '/app/compliance', icon: ShieldCheck, highlight: true },
    { name: t('nav.appeals'), path: '/app/appeals', icon: Scale, highlight: true },
    { name: t('nav.affidavits'), path: '/app/affidavits', icon: FileSignature, highlight: true },
    { name: t('nav.myWork'), path: '/app/my-work', icon: FolderOpen },
    { name: t('nav.theory'), path: '/app/theory', icon: BookOpen },
    { name: t('nav.workflows'), path: '/app/workflows', icon: GitBranch },
    { name: t('nav.forms'), path: '/app/forms', icon: FileText },
    { name: t('nav.cases'), path: '/app/jurisprudence', icon: Gavel },
    { name: t('nav.costs'), path: '/app/costs', icon: Calculator },
    { name: t('nav.terminology'), path: '/app/terminology', icon: BookA },
  ];
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);

  // Listen for "Ask AI Senior Counsel" events from Theory/Workflows pages
  useEffect(() => {
    const handler = () => setIsAITutorOpen(true);
    window.addEventListener('ai-prefill', handler);
    return () => window.removeEventListener('ai-prefill', handler);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" />
          <span className="font-serif font-bold text-lg tracking-wide text-foreground">{t('brand.name')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Button variant="ghost" size="icon" onClick={() => setIsAITutorOpen(true)}>
            <BotMessageSquare className="h-5 w-5 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <Scale className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-serif font-bold text-xl tracking-wide text-foreground">{t('brand.name')}</h1>
            <p className="text-[10px] uppercase tracking-widest text-primary font-semibold mt-0.5">{t('brand.tagline')}</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.startsWith(item.path);
            const isHighlight = (item as any).highlight;
            return (
              <Link 
                key={item.name} 
                href={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-primary/10 text-primary border border-primary/20 shadow-inner' 
                    : isHighlight
                    ? 'text-primary border border-primary/25 bg-primary/5 hover:bg-primary/10'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'}
                `}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon className={`h-5 w-5 ${isActive || isHighlight ? 'text-primary' : ''}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-2 bg-background/30">
          <Link
            href="/app/subscribe"
            onClick={() => setIsSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 border ${
              location.startsWith('/app/subscribe')
                ? 'bg-primary/10 text-primary border-primary/20 shadow-inner'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground border-transparent'
            }`}
          >
            <Sparkles className="h-5 w-5" />
            {t('nav.subscription')}
          </Link>
          <LanguageSwitcher className="w-full" />
          <Button 
            className="w-full justify-start gap-3 bg-card border border-primary/30 text-primary hover:bg-primary/10 shadow-none" 
            onClick={() => {
              setIsAITutorOpen(true);
              setIsSidebarOpen(false);
            }}
          >
            <BotMessageSquare className="h-5 w-5" />
            {t('nav.askAI')}
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="h-5 w-5" />
            {t('nav.logout')}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        <div className="max-w-6xl mx-auto pb-24">
          {children}
        </div>
      </main>

      <AITutor isOpen={isAITutorOpen} onClose={() => setIsAITutorOpen(false)} />
    </div>
  );
}
