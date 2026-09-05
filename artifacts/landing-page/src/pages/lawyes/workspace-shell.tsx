import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Briefcase, LogOut, Loader2, LayoutPanelLeft, Users, Eye, MessageSquare } from "lucide-react";
import { useAuth } from "./use-auth";
import { useLawyesIdentity, useLawyesMatter, useLawyesMatters } from "./api";
import { MatterWorkspace } from "./matter-workspace";
import { TeamPanel } from "./team-panel";

export function WorkspaceShell() {
  const params = useParams();
  const matterId = params.matterId;
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  
  const { data: matters, isLoading, error } = useLawyesMatters();
  const identity = useLawyesIdentity();
  const recentWorkspace = useLawyesMatter(matterId);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(false);
  const selectedMatter = matters?.find((matter) => String(matter.id) === matterId);
  const isOwner = identity.data?.role === "owner";
  const shellError = error || identity.error;

  // If there's an error and it's 401, logout is handled by queryFn throwing Error
  useEffect(() => {
    if (shellError && shellError.message === "Unauthorized") {
      logout();
    }
  }, [shellError, logout]);

  if (isLoading || identity.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (shellError && shellError.message !== "Unauthorized") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans">
        <div className="max-w-md text-center p-8 bg-white rounded-xl shadow-sm border border-red-200">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 font-bold text-xl">!</span>
          </div>
          <h2 className="text-xl font-medium text-slate-900 mb-2">Access Issue</h2>
          <p className="text-slate-600 text-sm mb-6">
            {shellError.message}
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
    <div className="flex h-[100dvh] bg-background overflow-hidden font-sans safe-preview">
      {/* Sidebar */}
      <aside 
        className={`flex flex-col transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-64 absolute md:relative md:w-72' : 'w-0 md:w-[68px]'} border-r z-20 shrink-0 h-full overflow-hidden`}
        style={{
          backgroundColor: 'hsl(var(--lawyes-sidebar))',
          borderColor: 'hsl(var(--lawyes-sidebar-border))',
          color: 'hsl(var(--lawyes-sidebar-text))'
        }}
      >
        <div className="h-14 md:h-16 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor: 'hsl(var(--lawyes-sidebar-border))' }}>
          {sidebarOpen && (
            <div className="font-serif text-xl tracking-tight font-medium truncate flex items-center gap-2">
              <img
                src="/lawyes-logo.png"
                alt="LAWYes"
                className="h-7 md:h-8 w-auto max-w-[132px] object-contain object-left"
              />
            </div>
          )}
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`p-1.5 rounded-md transition-colors hover:bg-black/5 ${!sidebarOpen && 'mx-auto'}`}
            style={{ color: 'hsl(var(--lawyes-sidebar-muted))' }}
            title="Toggle Sidebar"
            aria-label={sidebarOpen ? "Collapse matter navigation" : "Expand matter navigation"}
            data-testid="button-toggle-matter-navigation"
          >
            <LayoutPanelLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 md:py-4 flex flex-col gap-1 px-2 md:px-3 no-scrollbar">
          {sidebarOpen && <div className="px-2 text-[10px] font-bold uppercase tracking-wider mb-2 mt-1" style={{ color: 'hsl(var(--lawyes-sidebar-muted))' }}>Active Matters</div>}
          
          {matters?.map((matter) => {
            const isActive = matterId === String(matter.id);
            return (
              <button
                key={matter.id}
                onClick={() => setLocation(`/lawyes/${matter.id}`)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${isActive ? 'font-medium' : ''}`}
                style={{
                  backgroundColor: isActive ? 'hsl(var(--lawyes-sidebar-hover))' : 'transparent',
                  color: isActive ? 'hsl(var(--lawyes-sidebar-text))' : 'hsl(var(--lawyes-sidebar-text))',
                }}
                title={!sidebarOpen ? matter.title : undefined}
                data-testid={`button-matter-${matter.id}`}
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

          {sidebarOpen && matterId && (
            <div className="mt-5 border-t pt-4" style={{ borderColor: "hsl(var(--lawyes-sidebar-border))" }}>
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: "hsl(var(--lawyes-sidebar-muted))" }}>
                Recent work
              </div>
              {recentWorkspace.isLoading ? (
                <div className="flex items-center gap-2 px-2 py-2 text-xs opacity-60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading discussions
                </div>
              ) : recentWorkspace.data?.conversations.length ? (
                <div className="space-y-1">
                  {recentWorkspace.data.conversations.slice(0, 5).map((conversation) => (
                    <div
                      key={conversation.id}
                      className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs"
                      data-testid={`text-recent-conversation-${conversation.id}`}
                    >
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                      <span className="line-clamp-2 leading-relaxed">
                        {conversation.title || conversation.name || "Matter discussion"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-2 py-2 text-xs leading-relaxed opacity-60">No recent discussions in this matter.</p>
              )}
            </div>
          )}
        </div>

        <div className="p-3 md:p-4 border-t shrink-0 space-y-2" style={{ borderColor: 'hsl(var(--lawyes-sidebar-border))' }}>
          {identity.data && sidebarOpen && (
            <div className="border-b pb-3 mb-3 px-1" style={{ borderColor: 'hsl(var(--lawyes-sidebar-border))' }} data-testid="text-current-member">
              <p className="truncate text-sm font-medium">{identity.data.member?.name || "Workspace owner"}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] capitalize opacity-60 font-medium">
                {identity.data.role === "viewer" && <Eye className="h-3 w-3" />}
                {identity.data.role}
              </p>
            </div>
          )}
          {isOwner && (
            <button
              onClick={() => setTeamOpen(true)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-black/5 font-medium ${!sidebarOpen && 'px-0'}`}
              style={{ color: 'hsl(var(--lawyes-sidebar-text))' }}
              title="Manage Team"
              aria-label="Manage team"
              data-testid="button-manage-team"
            >
              <Users className="w-4 h-4" />
              {sidebarOpen && <span>Team</span>}
            </button>
          )}
          <button
            onClick={logout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors hover:bg-red-50 hover:text-red-600 font-medium ${!sidebarOpen && 'px-0'}`}
            style={{ color: 'hsl(var(--lawyes-sidebar-text))' }}
            title="End Session"
            data-testid="button-end-lawyes-session"
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span>End Session</span>}
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 flex flex-col bg-background z-10 relative">
        {matterId ? (
          <MatterWorkspace matterId={matterId} onShareClick={() => setTeamOpen(true)} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center bg-background">
            <div className="max-w-md">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-border">
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
      {isOwner && (
        <TeamPanel
          open={teamOpen}
          onOpenChange={setTeamOpen}
          matterId={matterId}
          matterTitle={selectedMatter?.title}
        />
      )}
    </div>
  );
}
