import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import WorkspaceLayout from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, FileText, BookOpen, FileCheck, Scale, Building, Shield, ChevronRight } from "lucide-react";
import { isAuthenticated, authHeaders } from "@/lib/auth";

const ICON_MAP: Record<string, React.ComponentType<{className?: string}>> = {
  FileText, BookOpen, FileCheck, Scale, Building, Shield, Sparkles,
};

export default function ToolsListPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) setLocation("/access");
  }, [setLocation]);

  const { data: tools, isLoading } = useQuery({
    queryKey: ["ccb-tools"],
    queryFn: async () => {
      const res = await fetch("/api/ccb/tools/list", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load tools");
      return res.json() as Promise<Array<{
        id: string; name: string; description: string; category: string; icon: string;
      }>>;
    },
  });

  // Group by category
  const grouped: Record<string, typeof tools> = {};
  if (tools) {
    for (const tool of tools) {
      if (!grouped[tool.category]) grouped[tool.category] = [];
      grouped[tool.category]!.push(tool);
    }
  }

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/workspace">
            <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Workspace
            </Button>
          </Link>
        </div>
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-serif font-bold text-foreground">All AI Tools</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : !tools?.length ? (
          <p className="text-muted-foreground text-center py-16">No tools available.</p>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([category, categoryTools]) => (
              <div key={category}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                  {category}
                </h2>
                <div className="space-y-1">
                  {categoryTools!.map((tool) => {
                    const Icon = ICON_MAP[tool.icon] ?? FileText;
                    return (
                      <Link key={tool.id} href={`/workspace/tool/${tool.id}`}>
                        <div className="flex items-center gap-4 p-3 rounded-lg border border-transparent hover:border-border hover:bg-muted/40 transition-colors cursor-pointer group">
                          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                              {tool.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate">{tool.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </WorkspaceLayout>
  );
}
