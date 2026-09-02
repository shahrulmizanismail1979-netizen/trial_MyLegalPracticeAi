import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Briefcase, ChevronRight, LogOut, Loader2, LayoutPanelLeft } from "lucide-react";
import { useAuth } from "./use-auth";
import { useLawyesMatters } from "./api";
import { MatterWorkspace } from "./matter-workspace";

export function WorkspaceShell() {
  const params = useParams();
  const matterId = params.matterId;
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  
  const { data: matters, isLoading, error } = useLawyesMatters();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // If there's an error and it's 401, logout is handled by queryFn throwing Error, but wait, we need to handle it better if possible.
  useEffect(() => {
    if (error && error.message === "Unauthorized") {
      logout();
    }
  }, [error, logout]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && error.message !== "Unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="max-w-md text-center p-8 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-red-200 dark:border-red-900/50">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 dark:text-red-400 font-bold text-xl">!</span>
          </div>
          <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Access Issue</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            {error.message}
          </p>
          <button 
            onClick={logout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-md text-sm font-medium transition-colors"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside 
        className={`flex flex-col bg-slate-900 text-white transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64 absolute md:relative md:w-72' : 'w-0 md:w-16'} border-r border-slate-800 z-20 shrink-0 h-full overflow-hidden`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          {sidebarOpen && (
            <div className="font-serif text-xl tracking-tight font-medium truncate">
              LAW<span className="italic text-slate-400">Yes</span>
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
            title="Toggle Sidebar"
          >
            <LayoutPanelLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-2 no-scrollbar">
          {sidebarOpen && <div className="px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Active Matters</div>}
          
          {matters?.map((matter) => (
            <button
              key={matter.id}
              onClick={() => setLocation(`/lawyes/${matter.id}`)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${matterId === matter.id ? 'bg-slate-800 text-white font-medium' : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="truncate">{matter.title}</div>
                  {matter.reference && (
                    <div className="text-xs text-slate-500 truncate mt-0.5">{matter.reference}</div>
                  )}
                </div>
              )}
            </button>
          ))}
          
          {matters?.length === 0 && sidebarOpen && (
            <div className="px-3 py-4 text-sm text-slate-500 text-center">
              No matters assigned.
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 shrink-0">
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${!sidebarOpen && 'px-0'}`}
            title="End Session"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>End Session</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900 z-10">
        {matterId ? (
          <MatterWorkspace matterId={matterId} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Briefcase className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-xl font-serif font-medium text-slate-900 dark:text-white mb-2">
                No Matter Selected
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                Select a matter from the sidebar to access its workspace, review documents, and instruct the assistant.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
