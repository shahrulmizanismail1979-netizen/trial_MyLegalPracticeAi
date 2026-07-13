import { useCrimSearchContent, getCrimSearchContentQueryKey } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { Search, ArrowRight, SearchX, BookOpen, Scale, FileText, Workflow, Files, BookA, Landmark } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const typeConfig: Record<string, { icon: typeof BookOpen; label: string; href: (id: number) => string }> = {
  "topic": { icon: BookOpen, label: "Topic", href: (id) => `/workspace/topics/${id}` },
  "case-law": { icon: Scale, label: "Case Law", href: (id) => `/workspace/case-laws/${id}` },
  "cause-paper": { icon: FileText, label: "Cause Paper", href: (id) => `/workspace/cause-papers/${id}` },
  "workflow": { icon: Workflow, label: "Workflow", href: (id) => `/workspace/workflows/${id}` },
  "sample-document": { icon: Files, label: "Document", href: (id) => `/workspace/sample-documents/${id}` },
  "glossary": { icon: BookA, label: "Glossary", href: (id) => `/workspace/glossary/${id}` },
  "cost-fee": { icon: Landmark, label: "Cost/Fee", href: (id) => `/workspace/costs-fees/${id}` },
};

export function SearchPage() {
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialQ = urlParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);

  const { data: results, isLoading } = useCrimSearchContent(
    { q: query },
    { query: { enabled: query.length >= 2, queryKey: getCrimSearchContentQueryKey({ q: query }) } }
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-8 w-8 text-primary" />
          Search
        </h1>
        <p className="text-muted-foreground">Search across all criminal law resources.</p>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search topics, case laws, documents..."
          className="pl-11 text-lg h-12 bg-background/50 backdrop-blur-sm"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="input-global-search"
          autoFocus
        />
      </div>

      {query.length < 2 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="mx-auto h-12 w-12 mb-4 opacity-30" />
          <p>Type at least 2 characters to search.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : results?.total === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg border-border">
          <SearchX className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <h3 className="text-lg font-medium">No results found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try different search terms.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{results?.total} result{results?.total !== 1 ? "s" : ""} found</p>
          {results?.results.map((result) => {
            const config = typeConfig[result.type];
            const Icon = config?.icon || Search;
            return (
              <Link key={`${result.type}-${result.id}`} href={config?.href(result.id) || "#"}>
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer group" data-testid={`search-result-${result.type}-${result.id}`}>
                  <CardHeader className="flex flex-row items-start gap-4 pb-2">
                    <div className="flex-shrink-0 mt-1">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="font-serif text-lg group-hover:text-primary transition-colors">{result.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs bg-secondary/50">{config?.label || result.type}</Badge>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-2" />
                  </CardHeader>
                  <CardContent className="pl-[3.25rem]">
                    <CardDescription className="line-clamp-2">{result.excerpt}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
