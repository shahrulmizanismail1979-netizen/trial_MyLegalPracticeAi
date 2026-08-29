import React from 'react';
import { Scale, LogOut, Menu, FolderKanban, Calculator, BookOpen } from 'lucide-react';
import { useLocation } from 'wouter';
import { useApp } from '@/contexts/AppContext';
import { NAV_MENU } from '@/lib/data';
import { clearStoredPersona } from '@workspace/persona-client';

export function Sidebar({ mobileOpen, setMobileOpen }: { mobileOpen: boolean, setMobileOpen: (v: boolean) => void }) {
  const { activeSection, setActiveSection, setIsAuthenticated } = useApp();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    setIsAuthenticated(false);
    // Clear the shared persona cache so a shared browser never leaks the
    // previous subscriber's professional mode.
    clearStoredPersona();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-gold-950/80 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-gold-950 border-r border-gold-800 transform transition-transform duration-300 ease-in-out flex flex-col ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        
        {/* Brand Header */}
        <div className="h-20 flex items-center px-6 border-b border-gold-800 shrink-0">
          <Scale className="w-8 h-8 text-amber-500 mr-3" />
          <span className="font-serif font-bold text-xl text-slate-50 tracking-wide">
            MYConvey<span className="text-amber-500">AI</span>
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2 mt-2">Curriculum</div>
          {NAV_MENU.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileOpen(false);
                }}
                className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center group ${
                  isActive 
                    ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20' 
                    : 'text-slate-400 hover:bg-gold-900 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-amber-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {item.title}
              </button>
            );
          })}

          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 ml-2 mt-6">Practice</div>
          <button
            onClick={() => {
              navigate('/matters');
              setMobileOpen(false);
            }}
            className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center group text-slate-400 hover:bg-gold-900 hover:text-slate-200 border border-transparent"
          >
            <FolderKanban className="w-5 h-5 mr-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
            Matter Files
          </button>
          <button
            onClick={() => {
              navigate('/billing');
              setMobileOpen(false);
            }}
            className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center group text-slate-400 hover:bg-gold-900 hover:text-slate-200 border border-transparent"
          >
            <Calculator className="w-5 h-5 mr-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
            Billing
          </button>
          <button
            onClick={() => {
              navigate('/case-law');
              setMobileOpen(false);
            }}
            className="w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center group text-slate-400 hover:bg-gold-900 hover:text-slate-200 border border-transparent"
          >
            <BookOpen className="w-5 h-5 mr-3 text-slate-500 group-hover:text-slate-300 transition-colors" />
            Case Law
          </button>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gold-800 shrink-0">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/20"
          >
            <LogOut className="w-4 h-4" />
            End Session
          </button>
        </div>
      </aside>
    </>
  );
}
