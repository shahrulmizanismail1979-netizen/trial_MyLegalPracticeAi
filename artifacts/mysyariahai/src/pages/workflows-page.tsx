import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function WorkflowsPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["workflows", gate, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      return api.workflows.list(params);
    },
  });

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Procedures", "Kembali ke Tatacara")}
        </Button>
        <WorkflowDetail workflow={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Procedural Workflows", "Tatacara Prosedur")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Step-by-step guides for Shariah court procedures", "Panduan langkah demi langkah untuk prosedur mahkamah Syariah")}
        </p>
      </div>

      <Input
        placeholder={mode === "bm" ? "Cari prosedur..." : "Search procedures..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {workflows?.map((w: any) => (
            <Card key={w.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(w)}>
              <CardContent className="p-4">
                <Badge variant="outline" className="mb-2 text-xs">{mode === "bm" ? w.categoryBm : w.category}</Badge>
                <h3 className="font-serif font-semibold text-foreground text-sm">
                  {mode === "bm" ? w.titleBm : mode === "en" ? w.titleEn : `${w.titleEn} / ${w.titleBm}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {mode === "bm" ? w.descriptionBm : w.descriptionEn}
                </p>
                <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
                  <span>{w.estimatedTimeline}</span>
                  {w.courtFees && <span>| {w.courtFees}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowDetail({ workflow: w }: { workflow: any }) {
  const { t, mode } = useLanguage();

  let steps: any[] = [];
  try {
    steps = typeof w.stepsJson === "string" ? JSON.parse(w.stepsJson) : w.stepsJson || [];
  } catch {
    steps = [];
  }

  return (
    <div className="space-y-4">
      <div>
        <Badge variant="outline" className="mb-2">{mode === "bm" ? w.categoryBm : w.category}</Badge>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {mode === "bm" ? w.titleBm : mode === "en" ? w.titleEn : `${w.titleEn} / ${w.titleBm}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          {mode === "bm" ? w.descriptionBm : w.descriptionEn}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t("Timeline", "Tempoh")}</p>
            <p className="text-sm font-semibold text-foreground">{w.estimatedTimeline}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t("Court Fees", "Fi Mahkamah")}</p>
            <p className="text-sm font-semibold text-foreground">{w.courtFees || "N/A"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t("Steps", "Langkah")}</p>
            <p className="text-sm font-semibold text-foreground">{steps.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold">{t("Procedure Steps", "Langkah-Langkah Prosedur")}</h3>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step: any, i: number) => (
              <div key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary">
                  {step.step}
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="font-semibold text-sm text-foreground">
                    {mode === "bm" ? step.titleBm : mode === "en" ? step.titleEn : `${step.titleEn} / ${step.titleBm}`}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === "bm" ? step.descriptionBm : step.descriptionEn}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {w.requiredDocuments && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Required Documents", "Dokumen Diperlukan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-1.5">
              {w.requiredDocuments.split(",").map((doc: string) => (
                <Badge key={doc.trim()} variant="outline" className="text-xs">{doc.trim()}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
