import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import WorkspaceLayout from "./layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Scale, Building, Landmark, FileText, Shield, 
  BookOpen, Gavel, Briefcase, FileSearch, Calculator, 
  AlertTriangle, Search, Cpu, Type, Target, Clock,
  FileEdit, BookMarked, Calculator as CalculatorIcon, Sparkles
} from "lucide-react";
import { isAuthenticated, authHeaders } from "@/lib/auth";
import { motion } from "framer-motion";

// Helper to map string icon name to a Lucide React component
const iconMap: Record<string, React.ElementType> = {
  scale: Scale,
  building: Building,
  landmark: Landmark,
  "file-text": FileText,
  shield: Shield,
  "book-open": BookOpen,
  gavel: Gavel,
  briefcase: Briefcase,
  "file-search": FileSearch,
  calculator: Calculator,
  "alert-triangle": AlertTriangle,
  search: Search,
  cpu: Cpu,
  type: Type
};

function getIconComponent(iconName: string) {
  const Icon = iconMap[iconName.toLowerCase()] || Scale;
  return Icon;
}

export default function WorkspaceIndex() {
  const [, setLocation] = useLocation();
  const { data: tools, isLoading } = useQuery({
    queryKey: ["ccb-tools"],
    queryFn: async () => {
      const res = await fetch("/api/ccb/tools/list", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load tools");
      return res.json() as Promise<Array<{id:string;name:string;description:string;category:string;icon:string;fields:any[];example?:Record<string,string>;sampleNote?:string}>>;
    },
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  if (isLoading) {
    return (
      <WorkspaceLayout>
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
          <div>
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  // Group tools by category
  type ToolItem = NonNullable<typeof tools>[number];
  const categories: Record<string, ToolItem[]> = {};
  if (tools) {
    tools.forEach(tool => {
      if (!categories[tool.category]) {
        categories[tool.category] = [];
      }
      categories[tool.category].push(tool);
    });
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-12">
        
        {/* Hero Section */}
        <div className="relative rounded-2xl overflow-hidden bg-card border border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background z-0"></div>
          <div className="absolute inset-0 bg-[url('/bg-pattern.svg')] opacity-20 mix-blend-overlay z-0"></div>
          
          <div className="relative z-10 p-8 md:p-10">
            <div className="max-w-2xl mb-8">
              <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight text-foreground mb-4">
                Welcome to <span className="text-primary">MyCCBLitAI</span>
              </h1>
              <p className="text-muted-foreground text-lg leading-relaxed">
                The premium legal intelligence platform for Malaysian corporate and commercial litigation. Enhance your practice with AI-powered drafting, research, and strategy tools.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background/60 backdrop-blur-md border border-border/50 rounded-xl p-4 flex flex-col">
                <span className="text-3xl font-serif font-bold text-foreground" data-testid="stat-tool-count">{tools?.length ?? 0}</span>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">AI Tools</span>
              </div>
              <div className="bg-background/60 backdrop-blur-md border border-border/50 rounded-xl p-4 flex flex-col">
                <span className="text-3xl font-serif font-bold text-foreground">3</span>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Calculators</span>
              </div>
              <div className="bg-background/60 backdrop-blur-md border border-border/50 rounded-xl p-4 flex flex-col">
                <span className="text-3xl font-serif font-bold text-foreground">8</span>
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider mt-1">Key Statutes</span>
              </div>
              <div className="bg-primary/20 backdrop-blur-md border border-primary/30 rounded-xl p-4 flex flex-col justify-center items-center">
                <Sparkles className="w-8 h-8 text-primary mb-1" />
                <span className="text-sm font-bold text-primary uppercase tracking-wider">AI-Powered</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-serif font-semibold text-foreground mb-4 flex items-center">
            <Cpu className="w-5 h-5 mr-2 text-primary" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/workspace/tool/draft-pleadings">
              <Card className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group h-full" data-testid="quick-action-draft">
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <FileEdit className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Draft a Document</h3>
                  <p className="text-xs text-muted-foreground mt-1">Generate pleadings, letters & forms</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/workspace/chat">
              <Card className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group h-full" data-testid="quick-action-research">
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <Search className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Research Case Law</h3>
                  <p className="text-xs text-muted-foreground mt-1">Ask the Legal AI Chat assistant</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/workspace/calculators">
              <Card className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group h-full" data-testid="quick-action-calculate">
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <CalculatorIcon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Calculate Fees</h3>
                  <p className="text-xs text-muted-foreground mt-1">Filing fees, interest & limitations</p>
                </CardContent>
              </Card>
            </Link>
            
            <Link href="/workspace/strategy">
              <Card className="cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all group h-full" data-testid="quick-action-strategy">
                <CardContent className="p-5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Plan Strategy</h3>
                  <p className="text-xs text-muted-foreground mt-1">Generate comprehensive case plans</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="pt-4">
          <h2 className="text-2xl font-serif font-bold tracking-tight text-foreground mb-6">AI Tools Directory</h2>
          {Object.entries(categories).map(([category, categoryTools]) => (
            <div key={category} className="space-y-6 mb-12">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-serif font-semibold text-primary">{category}</h2>
                <div className="h-px flex-1 bg-border/50"></div>
              </div>
              
              <motion.div 
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {categoryTools?.map(tool => {
                  const IconComponent = getIconComponent(tool.icon);
                  return (
                    <motion.div variants={item} key={tool.id}>
                      <Link href={`/workspace/tool/${tool.id}`}>
                        <Card className="h-full cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group bg-card/40 backdrop-blur-sm" data-testid={`card-tool-${tool.id}`}>
                          <CardHeader>
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                              <IconComponent className="w-6 h-6 text-primary" />
                            </div>
                            <CardTitle className="font-serif group-hover:text-primary transition-colors">{tool.name}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <CardDescription className="text-sm leading-relaxed line-clamp-3">
                              {tool.description}
                            </CardDescription>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          ))}

          {(!tools || tools.length === 0) && (
            <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card/20">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground mb-2">No tools available</h3>
              <p className="text-muted-foreground">Please check back later or contact the administrator.</p>
            </div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
