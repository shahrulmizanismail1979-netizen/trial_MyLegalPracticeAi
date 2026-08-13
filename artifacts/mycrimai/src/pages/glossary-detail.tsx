import { useCrimGetGlossaryTerm, getCrimGetGlossaryTermQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, BookA, Languages, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GlossaryDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: term, isLoading, error } = useCrimGetGlossaryTerm(id, {
    query: { enabled: !!id, queryKey: getCrimGetGlossaryTermQueryKey(id) }
  });

  if (isLoading) {
    return <div className="space-y-6 max-w-4xl mx-auto"><Skeleton className="h-10 w-32" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-[200px] w-full mt-8" /></div>;
  }

  if (error || !term) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Term not found</h2>
        <Button className="mt-6" asChild><Link href="/workspace/glossary">Back to Glossary</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/workspace/glossary"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Glossary</Link>
      </Button>

      <article className="space-y-8">
        <header className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight">{term.term}</h1>
          <p className="text-xl text-primary/70 italic flex items-center gap-2">
            <Languages className="h-5 w-5" />
            {term.malayTranslation}
          </p>
        </header>

        <Separator className="bg-border/60" />

        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle className="font-serif text-xl">Definition</CardTitle></CardHeader>
          <CardContent>
            <p className="text-foreground leading-relaxed text-lg">{term.definition}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2"><LinkIcon className="h-5 w-5" />Related Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {term.relatedTerms.split(", ").map((rt) => (
                <Badge key={rt} variant="secondary" className="text-sm px-3 py-1">{rt}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </article>
    </div>
  );
}
