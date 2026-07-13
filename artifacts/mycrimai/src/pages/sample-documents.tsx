import { useCrimListSampleDocuments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Files, Search, ArrowRight, FileX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function SampleDocumentsPage() {
  const [search, setSearch] = useState("");
  const { data: docs, isLoading } = useCrimListSampleDocuments();

  const filtered = docs?.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase()) ||
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Files className="h-8 w-8 text-primary" />
            Sample Documents
          </h1>
          <p className="text-muted-foreground">Templates and sample documents for criminal practice.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." className="pl-9 bg-background/50 backdrop-blur-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-documents" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50"><CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="h-5 w-24" /></CardContent></Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg border-border">
            <FileX className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No documents found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          filtered?.map((doc) => (
            <Link key={doc.id} href={`/workspace/sample-documents/${doc.id}`}>
              <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer group flex flex-col" data-testid={`card-document-${doc.id}`}>
                <CardHeader>
                  <CardTitle className="font-serif leading-snug group-hover:text-primary transition-colors">{doc.title}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-2">{doc.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-medium bg-secondary/50">{doc.category}</Badge>
                    <Badge variant="outline">{doc.documentType}</Badge>
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
