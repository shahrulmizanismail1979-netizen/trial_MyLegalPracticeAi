import { useCrimListCausePapers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { FileText, Search, ArrowRight, FileQuestion } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function CausePapersPage() {
  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState<"all" | "en" | "ms">("all");
  const { data: causePapers, isLoading } = useCrimListCausePapers(
    language === "all" ? undefined : { language },
  );

  const filtered = causePapers?.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.court.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase()) ||
    (p.language === "en" ? "english" : "bahasa melayu malay").includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Cause Papers
          </h1>
          <p className="text-muted-foreground">Court document templates and precedents.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cause papers..." className="pl-9 bg-background/50 backdrop-blur-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-cause-papers" />
        </div>
      </div>
      <div className="flex gap-2" role="group" aria-label="Filter cause papers by language">
        {([["all", "All"], ["en", "English"], ["ms", "Bahasa Melayu"]] as const).map(([value, label]) => (
          <Button key={value} type="button" variant={language === value ? "default" : "outline"} size="sm" onClick={() => setLanguage(value)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-border/50"><CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="h-5 w-24" /></CardContent></Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg border-border">
            <FileQuestion className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No cause papers found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          filtered?.map((paper) => (
            <Link key={paper.id} href={`/workspace/cause-papers/${paper.id}`}>
              <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer group flex flex-col" data-testid={`card-cause-paper-${paper.id}`}>
                <CardHeader>
                  <CardTitle className="font-serif leading-snug group-hover:text-primary transition-colors">{paper.title}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-2">{paper.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-medium bg-secondary/50">{paper.category}</Badge>
                    <Badge variant="outline">{paper.court}</Badge>
                     <Badge variant={paper.language === "en" ? "default" : "outline"}>{paper.language === "en" ? "English" : "Bahasa Melayu"}</Badge>
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
