import { useCrimListCostsFees } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Landmark, Search, ArrowRight, CircleDollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function CostsFeesPage() {
  const [search, setSearch] = useState("");
  const { data: fees, isLoading } = useCrimListCostsFees();

  const filtered = fees?.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.description.toLowerCase().includes(search.toLowerCase()) ||
    f.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-8 w-8 text-primary" />
            Costs & Fees
          </h1>
          <p className="text-muted-foreground">Fee schedules and cost references for criminal practice.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search costs & fees..." className="pl-9 bg-background/50 backdrop-blur-sm" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-costs" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50"><CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-full" /></CardHeader><CardContent><Skeleton className="h-5 w-24" /></CardContent></Card>
          ))
        ) : filtered?.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed rounded-lg border-border">
            <CircleDollarSign className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-lg font-medium">No cost/fee entries found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search terms.</p>
          </div>
        ) : (
          filtered?.map((fee) => (
            <Link key={fee.id} href={`/workspace/costs-fees/${fee.id}`}>
              <Card className="h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all cursor-pointer group flex flex-col" data-testid={`card-cost-fee-${fee.id}`}>
                <CardHeader>
                  <CardTitle className="font-serif leading-snug group-hover:text-primary transition-colors">{fee.title}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-2">{fee.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="text-xl font-bold text-primary">{fee.amount}</div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-medium bg-secondary/50">{fee.category}</Badge>
                      <Badge variant="outline">{fee.courtType}</Badge>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
