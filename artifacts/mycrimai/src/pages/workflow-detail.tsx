import { useCrimGetWorkflow, getCrimGetWorkflowQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Workflow, Tag, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
}

export function WorkflowDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: workflow, isLoading, error } = useCrimGetWorkflow(id, {
    query: { enabled: !!id, queryKey: getCrimGetWorkflowQueryKey(id) }
  });

  if (isLoading) {
    return <div className="space-y-6 max-w-4xl mx-auto"><Skeleton className="h-10 w-32" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-[400px] w-full mt-8" /></div>;
  }

  if (error || !workflow) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Workflow not found</h2>
        <Button className="mt-6" asChild><Link href="/workspace/workflows">Back to Workflows</Link></Button>
      </div>
    );
  }

  let steps: WorkflowStep[] = [];
  try { steps = JSON.parse(workflow.steps); } catch { steps = []; }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/workspace/workflows"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Workflows</Link>
      </Button>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1"><Tag className="h-3 w-3" />{workflow.category}</Badge>
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1"><Clock className="h-3 w-3" />{workflow.estimatedDuration}</Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight">{workflow.title}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">{workflow.description}</p>
        </header>

        <Separator className="bg-border/60" />

        <div className="space-y-4">
          <h2 className="font-serif text-2xl font-bold">Steps</h2>
          <div className="space-y-4">
            {steps.map((step) => (
              <Card key={step.step} className="border-border/50 bg-card/50">
                <CardHeader className="flex flex-row items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="font-serif text-lg">{step.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pl-[4.5rem]">
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
