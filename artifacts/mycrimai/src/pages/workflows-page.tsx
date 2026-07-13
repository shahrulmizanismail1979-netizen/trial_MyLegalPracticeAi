import { useCrimListWorkflows } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Workflow, Search, ArrowRight, Clock, ListChecks } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function WorkflowsPage() {
  const [search, setSearch] = useState("");
  const { data: workflows, isLoading } = useCrimListWorkflows();

  const filtered = workflows?.filter(w =>
    w.title.toLowerCase().includes(search.toLowerCase()) ||
    w.description.toLowerCase().includes(search.toLowerCase()) ||
    w.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Workflow className="h-8 w-8 text-primary" />
            Practice Workflows
          </h1>
          <p className="text-muted-foreground">Step-by-step guides for criminal law procedures.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search workflows..." className="pl-9 bg-background/50 backdrop-blur-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-workflows" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50"><CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="h-5 w-24" /></CardContent></Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg border-border">
            <ListChecks className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No workflows found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          filtered?.map((wf) => (
            <Link key={wf.id} href={`/workspace/workflows/${wf.id}`}>
              <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer group flex flex-col" data-testid={`card-workflow-${wf.id}`}>
                <CardHeader>
                  <CardTitle className="font-serif leading-snug group-hover:text-primary transition-colors">{wf.title}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-2">{wf.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-medium bg-secondary/50">{wf.category}</Badge>
                    <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" />{wf.estimatedDuration}</Badge>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
