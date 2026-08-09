import { useCrimCheckSession, useCrimLogout } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { 
  BookOpen, 
  Scale, 
  FileText, 
  FolderKanban,
  Workflow, 
  Files, 
  BookA, 
  Landmark, 
  LogOut, 
  Search,
  Menu,
  Brain,
  FileEdit,
  FileSearch,
  MessageSquareWarning,
  Sparkles,
  Users,
  Gavel,
  Target,
  FileCheck,
  TrendingUp,
  Lightbulb,
  HelpCircle,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEntitlements, AI_TOOL_PATHS } from "@/lib/entitlements";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation as useWouterLocation } from "wouter";

const navigation = [
  { name: "Dashboard", href: "/workspace", icon: Landmark },
  { name: "How To Use", href: "/workspace/how-to-use", icon: HelpCircle },
  { name: "Theory Topics", href: "/workspace/topics", icon: BookOpen },
  { name: "Case Laws", href: "/workspace/case-laws", icon: Scale },
  { name: "Matter Files", href: "/workspace/matters", icon: FolderKanban },
  { name: "Cause Papers", href: "/workspace/cause-papers", icon: FileText },
  { name: "Practice Workflows", href: "/workspace/workflows", icon: Workflow },
  { name: "Sample Documents", href: "/workspace/sample-documents", icon: Files },
  { name: "Glossary", href: "/workspace/glossary", icon: BookA },
  { name: "Costs & Fees", href: "/workspace/costs-fees", icon: Landmark },
];

const aiTools = [
  { name: "AI Legal Research", href: "/workspace/ai/research", icon: Brain },
  { name: "Case Analyzer", href: "/workspace/ai/case-analyzer", icon: Scale },
  { name: "Document Drafter", href: "/workspace/ai/document-drafter", icon: FileEdit },
  { name: "Charge Analyzer", href: "/workspace/ai/charge-analyzer", icon: FileSearch },
  { name: "Cross-Examination", href: "/workspace/ai/cross-examination", icon: MessageSquareWarning },
  { name: "Sentencing Predictor", href: "/workspace/ai/sentencing", icon: Target },
  { name: "Legal Opinion", href: "/workspace/ai/legal-opinion", icon: FileCheck },
  { name: "Case Strategy", href: "/workspace/ai/case-strategy", icon: TrendingUp },
  { name: "Appeal Grounds", href: "/workspace/ai/appeal-grounds", icon: Lightbulb },
  { name: "Witness Practice", href: "/workspace/ai/witness-practice", icon: Users },
  { name: "Judge Practice", href: "/workspace/ai/judge-practice", icon: Gavel },
];

export function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isLoading } = useCrimCheckSession();
  const { hasTool } = useEntitlements();
  const logout = useCrimLogout();
  const [, setLocation] = useLocation();
  const [loc] = useWouterLocation();

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;
  }

  if (!session?.authenticated) {
    setLocation("/login");
    return null;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setLocation("/");
      }
    });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("q") as string;
    if (query) {
      setLocation(`/workspace/search?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r border-border bg-card">
          <SidebarHeader className="border-b border-primary/20 p-4">
            <div className="flex items-center gap-2">
              <Scale className="h-6 w-6 text-primary" />
              <span className="font-serif font-bold text-xl text-foreground">Mycrim<span className="text-primary">Ai</span></span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Library & Toolkit</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigation.map((item) => {
                    const isActive = loc === item.href || (item.href !== "/workspace" && loc.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                AI Tools
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {aiTools.map((item) => {
                    const isActive = loc === item.href || loc.startsWith(item.href);
                    const toolId = AI_TOOL_PATHS[item.href];
                    const locked = toolId ? !hasTool(toolId) : false;
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={locked ? `${item.name} — upgrade to unlock` : item.name}
                        >
                          <Link href={locked ? "/pricing" : item.href}>
                            <item.icon className="h-4 w-4" />
                            <span className={locked ? "text-muted-foreground" : ""}>{item.name}</span>
                            {locked && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t border-border p-4">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <SidebarTrigger />
            <div className="flex-1">
              <form onSubmit={handleSearch} className="relative max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  type="search"
                  placeholder="Search case laws, topics, documents..."
                  className="w-full pl-9 bg-muted/50 border-muted focus-visible:ring-primary"
                />
              </form>
            </div>
          </header>
          <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
