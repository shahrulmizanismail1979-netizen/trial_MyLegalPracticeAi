import { useCrimGetSampleDocument, getCrimGetSampleDocumentQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Tag, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SampleDocumentDetailPage() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: doc, isLoading, error } = useCrimGetSampleDocument(id, {
    query: { enabled: !!id, queryKey: getCrimGetSampleDocumentQueryKey(id) }
  });

  if (isLoading) {
    return <div className="space-y-6 max-w-4xl mx-auto"><Skeleton className="h-10 w-32" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-[400px] w-full mt-8" /></div>;
  }

  if (error || !doc) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Document not found</h2>
        <Button className="mt-6" asChild><Link href="/workspace/sample-documents">Back to Sample Documents</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Button variant="ghost" className="mb-6 -ml-4 text-muted-foreground hover:text-foreground" asChild>
        <Link href="/workspace/sample-documents"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Sample Documents</Link>
      </Button>

      <article className="space-y-8">
        <header className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1"><Tag className="h-3 w-3" />{doc.category}</Badge>
            <Badge variant="outline" className="flex items-center gap-1 font-medium px-2 py-1"><FileType className="h-3 w-3" />{doc.documentType}</Badge>
            <Badge className="px-2 py-1">{doc.language === "en" ? "English" : "Bahasa Melayu"}</Badge>
            {doc.pairedVersionId && (
              <Button variant="link" size="sm" className="h-auto px-1" asChild>
                <Link href={`/workspace/sample-documents/${doc.pairedVersionId}`}>
                  View {doc.language === "en" ? "Bahasa Melayu" : "English"} version
                </Link>
              </Button>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-foreground leading-tight">{doc.title}</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">{doc.description}</p>
        </header>

        <Separator className="bg-border/60" />

        <Card className="border-border/50 bg-card/50">
          <CardHeader><CardTitle className="font-serif text-xl">Document Content</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/30 p-6 rounded-lg leading-relaxed overflow-x-auto">{doc.content}</pre>
          </CardContent>
        </Card>
      </article>
    </div>
  );
}
