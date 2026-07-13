import { useCrimGetCostFee, getCrimGetCostFeeQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Tag, Building2, BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CostFeeDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: fee, isLoading, error } = useCrimGetCostFee(id, {
    query: { enabled: !!id, queryKey: getCrimGetCostFeeQueryKey(id) }
  });

  if (isLoading) {
    return <div className="space-y-6 max-w-4xl mx-auto"><Skeleton className="h-10 w-32" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-[200px] w-full mt-8" /></div>;
  }

  if (error || !fee) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Cost/fee not found</h2>
        <Link href="/workspace/costs-fees"><Button className="mt-6">Back to Costs & Fees</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link href="/workspace/costs-fees">
        <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Costs & Fees
        </Button>
      </Link>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1"><Tag className="h-3 w-3" />{fee.category}</Badge>
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1"><Building2 className="h-3 w-3" />{fee.courtType}</Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight">{fee.title}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">{fee.description}</p>
          <div className="text-3xl font-bold text-primary">{fee.amount}</div>
        </header>

        <Separator className="bg-border/60" />

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2"><BookOpenCheck className="h-5 w-5" />Legal Basis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed text-lg">{fee.legalBasis}</p>
          </CardContent>
        </Card>
      </article>
    </div>
  );
}
