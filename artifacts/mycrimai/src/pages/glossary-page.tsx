import { useCrimListGlossaryTerms } from "@workspace/api-client-react";
import { Link } from "wouter";
import { BookA, Search, ArrowRight, BookX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const { data: terms, isLoading } = useCrimListGlossaryTerms(
    activeLetter ? { letter: activeLetter } : undefined
  );

  const filtered = terms?.filter(t =>
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    t.definition.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookA className="h-8 w-8 text-primary" />
            Legal Glossary
          </h1>
          <p className="text-muted-foreground">Key terms and definitions in Malaysian criminal law.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search terms..." className="pl-9 bg-background/50 backdrop-blur-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-glossary" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button variant={activeLetter === null ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setActiveLetter(null)} data-testid="button-all-letters">All</Button>
        {ALPHABET.map((letter) => (
          <Button key={letter} variant={activeLetter === letter ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setActiveLetter(letter === activeLetter ? null : letter)} data-testid={`button-letter-${letter}`}>
            {letter}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50"><CardHeader><Skeleton className="h-6 w-1/3 mb-2" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></CardHeader></Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg border-border">
            <BookX className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No terms found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try a different letter or search term.</p>
          </div>
        ) : (
          filtered?.map((term) => (
            <Link key={term.id} href={`/workspace/glossary/${term.id}`}>
              <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer group" data-testid={`card-glossary-${term.id}`}>
                <CardHeader>
                  <CardTitle className="font-serif leading-snug group-hover:text-primary transition-colors">{term.term}</CardTitle>
                  <CardDescription className="text-xs text-primary/70 italic">{term.malayTranslation}</CardDescription>
                  <CardDescription className="line-clamp-2 mt-2">{term.definition}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {term.relatedTerms.split(", ").slice(0, 3).map((rt) => (
                      <Badge key={rt} variant="outline" className="text-xs">{rt}</Badge>
                    ))}
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
