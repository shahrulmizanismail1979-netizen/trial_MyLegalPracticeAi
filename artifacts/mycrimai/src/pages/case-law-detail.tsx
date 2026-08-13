import { useCrimGetCaseLaw, getCrimGetCaseLawQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Scale, Calendar, Tag, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CaseLawDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: caseLaw, isLoading, error } = useCrimGetCaseLaw(id, {
    query: { enabled: !!id, queryKey: getCrimGetCaseLawQueryKey(id) }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-[400px] w-full mt-8" />
      </div>
    );
  }

  if (error || !caseLaw) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Case law not found</h2>
        <p className="text-muted-foreground mt-2">The case you're looking for doesn't exist.</p>
        <Button className="mt-6" asChild><Link href="/workspace/case-laws">Back to Case Laws</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/workspace/case-laws"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Case Laws</Link>
      </Button>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1">
              <Tag className="h-3 w-3" />
              {caseLaw.category}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1">
              <Building2 className="h-3 w-3" />
              {caseLaw.court}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1">
              <Calendar className="h-3 w-3" />
              {caseLaw.year}
            </Badge>
          </div>

          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight" data-testid="text-case-name">
            {caseLaw.caseName}
          </h1>

          <p className="font-mono text-lg text-primary">{caseLaw.citation}</p>

          <p className="text-xl text-muted-foreground leading-relaxed">
            {caseLaw.summary}
          </p>
        </header>

        <Separator className="bg-border/60" />

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Key Principles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {caseLaw.keyPrinciples}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Full Text</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-foreground leading-relaxed">
              {caseLaw.fullText}
            </div>
          </CardContent>
        </Card>
      </article>
    </div>
  );
}
