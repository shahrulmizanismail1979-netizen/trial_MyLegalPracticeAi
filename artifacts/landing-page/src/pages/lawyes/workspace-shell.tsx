import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Briefcase, LogOut, Loader2, LayoutPanelLeft } from "lucide-react";
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

  // If there's an error and it's 401, logout is handled by queryFn throwing Error
  useEffect(() => {
    if (error && error.message === "Unauthorized") {
      logout();
    }
  }, [error, logout]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && error.message !== "Unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="max-w-md text-center p-8 bg-white rounded-xl shadow-sm border border-red-200">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 font-bold text-xl">!</span>
          </div>
          <h2 className="text-xl font-medium text-slate-900 mb-2">Access Issue</h2>
          <p className="text-slate-600 text-sm mb-6">
            {error.message}
          </p>
          <button 
            onClick={logout}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-md text-sm font-medium transition-colors"
          >
            Return to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-white overflow-hidden font-sans safe-preview">
      {/* Sidebar */}
      <aside 
        className={`flex flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64 absolute md:relative md:w-72' : 'w-0 md:w-16'} border-r z-20 shrink-0 h-full overflow-hidden`}
        style={{
          backgroundColor: 'hsl(var(--lawyes-sidebar))',
          borderColor: 'hsl(var(--lawyes-sidebar-border))',
          color: 'hsl(var(--lawyes-sidebar-text))'
        }}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor: 'hsl(var(--lawyes-sidebar-border))' }}>
          {sidebarOpen && (
            <div className="font-serif text-xl tracking-tight font-medium truncate flex items-center gap-2">
              <img
                src="/lawyes-logo.png"
                alt="LAWYes"
                className="h-8 w-auto max-w-[132px] object-contain object-left"
              />
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md transition-colors hover:bg-black/5"
            style={{ color: 'hsl(var(--lawyes-sidebar-muted))' }}
            title="Toggle Sidebar"
          >
            <LayoutPanelLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1 px-3 no-scrollbar">
          {sidebarOpen && <div className="px-2 text-xs font-bold uppercase tracking-wider mb-2 mt-2" style={{ color: 'hsl(var(--lawyes-sidebar-muted))' }}>Active Matters</div>}
          
          {matters?.map((matter) => {
            const isActive = matterId === matter.id;
            return (
              <button
                key={matter.id}
                onClick={() => setLocation(`/lawyes/${matter.id}`)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${isActive ? 'font-medium' : ''}`}
                style={{
                  backgroundColor: isActive ? 'hsl(var(--lawyes-sidebar-hover))' : 'transparent',
                  color: isActive ? 'hsl(var(--lawyes-sidebar-text))' : 'hsl(var(--lawyes-sidebar-text))',
                }}
              >
                <Briefcase className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : 'opacity-60'}`} />
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[13px]">{matter.title}</div>
                    {matter.reference && (
                      <div className="text-[11px] truncate mt-0.5 opacity-60 font-medium">{matter.reference}</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
          
          {matters?.length === 0 && sidebarOpen && (
            <div className="px-3 py-4 text-sm text-center opacity-60">
              No matters assigned.
            </div>
          )}
        </div>

        <div className="p-4 border-t shrink-0" style={{ borderColor: 'hsl(var(--lawyes-sidebar-border))' }}>
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-red-50 hover:text-red-600 font-medium ${!sidebarOpen && 'px-0'}`}
            style={{ color: 'hsl(var(--lawyes-sidebar-muted))' }}
            title="End Session"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>End Session</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 flex flex-col bg-background z-10 relative">
        {matterId ? (
          <MatterWorkspace matterId={matterId} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center bg-background">
            <div className="max-w-md">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-border">
                <Briefcase className="w-8 h-8 text-primary/60" />
              </div>
              <h2 className="text-2xl font-serif font-medium text-foreground mb-3">
                No Matter Selected
              </h2>
              <p className="text-muted-foreground text-[15px] leading-relaxed">
                Select a matter from the sidebar to access its workspace, review documents, and instruct the assistant.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
