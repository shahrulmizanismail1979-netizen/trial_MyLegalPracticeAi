import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, MessageSquare, Calculator, BookMarked, BookOpen, Target, Grid, FolderKanban } from "lucide-react";
import { clearToken, authHeaders, isAuthenticated } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { ParalegalWidget } from "@workspace/paralegal-widget";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
}

const paralegalRequest = (path: string, init?: RequestInit) =>
  fetch(`/api/ccb${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  const [, setLocation] = useLocation();
  const [currentLocation] = useLocation();
  const { data: tools } = useQuery({
    queryKey: ["ccb-tools"],
    queryFn: async () => {
      const res = await fetch("/api/ccb/tools/list", { headers: authHeaders() });
      if (!res.ok) return [];
      return res.json() as Promise<Array<{ id: string }>>;
    },
  });
  const toolCount = tools?.length ?? 0;

  const handleLogout = () => {
    clearToken();
    setLocation("/access");
  };

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border">
          <Link href="/workspace" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-sm bg-primary/20 border border-primary/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/30 transition-colors">
              <span className="font-serif font-bold text-primary text-sm">CCB</span>
            </div>
            <span className="font-serif font-bold text-lg tracking-tight">MyCCBLit<span className="text-primary">AI</span></span>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main</span>
          </div>
          <div className="px-2 space-y-1">
            <Link href="/workspace">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation === "/workspace" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-dashboard">
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </div>
            </Link>
            <Link href="/workspace">
              <div className={`flex items-center justify-between px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/tool") && currentLocation !== "/workspace/chat" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-tools">
                <div className="flex items-center gap-3">
                  <Grid size={18} />
                  <span>AI Tools</span>
                </div>
                <span className="bg-primary/20 text-primary text-xs py-0.5 px-2 rounded-full font-medium" data-testid="nav-tools-count">{toolCount}</span>
              </div>
            </Link>
            <Link href="/workspace/chat">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/chat") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-chat">
                <MessageSquare size={18} />
                <span>Legal AI Chat</span>
              </div>
            </Link>
            <Link href="/workspace/matters">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/matters") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-matters">
                <FolderKanban size={18} />
                <span>Matter Files</span>
              </div>
            </Link>
            <Link href="/workspace/billing">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/billing") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-billing">
                <Calculator size={18} />
                <span>Time &amp; Billing</span>
              </div>
            </Link>
          </div>

          <div className="px-4 mt-6 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Utilities</span>
          </div>
          <div className="px-2 space-y-1">
            <Link href="/workspace/calculators">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/calculators") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-calculators">
                <Calculator size={18} />
                <span>Calculators</span>
              </div>
            </Link>
            <Link href="/workspace/reference">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/reference") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-reference">
                <BookMarked size={18} />
                <span>Legal Reference</span>
              </div>
            </Link>
            <Link href="/workspace/case-law">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/case-law") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-case-law">
                <BookOpen size={18} />
                <span>Case Law</span>
              </div>
            </Link>
            <Link href="/workspace/strategy">
              <div className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${currentLocation.startsWith("/workspace/strategy") ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`} data-testid="nav-strategy">
                <Target size={18} />
                <span>Case Strategy</span>
              </div>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut size={18} className="mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-14 border-b border-border bg-card flex items-center justify-between px-4 flex-shrink-0">
          <Link href="/workspace" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-sm bg-primary/20 border border-primary/50 flex items-center justify-center">
              <span className="font-serif font-bold text-primary text-[10px]">CCB</span>
            </div>
            <span className="font-serif font-bold tracking-tight">MyCCBLit<span className="text-primary">AI</span></span>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-mobile-logout">
            <LogOut size={18} />
          </Button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
      {isAuthenticated() && (
        <ParalegalWidget
          portalName="MyCorpCommBankLitAI"
          request={paralegalRequest}
          accent="#8a6d2f"
        />
      )}
    </div>
  );
}
