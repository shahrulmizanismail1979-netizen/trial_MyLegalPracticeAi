import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMatter } from "@/contexts/MatterContext";
import { useCase, useExtractDocuments } from "@/hooks/use-irac-api";
import { useStreamStage } from "@/hooks/use-stream";
import { JourneyStepper } from "@/components/JourneyStepper";
import { CaseIntake } from "@/components/CaseIntake";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CitationsList } from "@/components/CitationsList";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, FileText, CheckCircle2, ChevronRight, AlertTriangle, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";
import { IracStage } from "@/lib/irac-api";

const STAGES: { id: IracStage; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { id: "issues", labelKey: "tool.matter.stage.issues.label", descKey: "tool.matter.stage.issues.desc" },
  { id: "research", labelKey: "tool.matter.stage.research.label", descKey: "tool.matter.stage.research.desc" },
  { id: "application", labelKey: "tool.matter.stage.application.label", descKey: "tool.matter.stage.application.desc" },
  { id: "opinion", labelKey: "tool.matter.stage.opinion.label", descKey: "tool.matter.stage.opinion.desc" },
];

// The "research" stage maps to the backend case-state key "rules"; all others match.
type CaseStageKey = "issues" | "rules" | "application" | "opinion";
const STAGE_KEY: Record<IracStage, CaseStageKey> = {
  issues: "issues",
  research: "rules",
  application: "application",
  opinion: "opinion",
};

export default function Matter() {
  const { caseId, pathwayId, setMatter, markAnalyzed, addSourceFiles } = useMatter();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const extractMutation = useExtractDocuments();
  const { data: caseData, refetch: refetchCase } = useCase(caseId);
  const streamStage = useStreamStage();
  
  const [activeTab, setActiveTab] = useState<IracStage>("issues");
  const [showAddMore, setShowAddMore] = useState(false);

  useEffect(() => {
    if (!streamStage.isStreaming && streamStage.content && !streamStage.error) {
      markAnalyzed();
    }
  }, [streamStage.isStreaming, streamStage.content, streamStage.error, markAnalyzed]);

  if (!pathwayId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-serif mb-2">{t("tool.matter.noPathway.title")}</h2>
          <p className="text-muted-foreground mb-6">{t("tool.matter.noPathway.desc")}</p>
          <Button onClick={() => setLocation("/")}>{t("tool.matter.noPathway.return")}</Button>
        </div>
      </div>
    );
  }

  const handleIntake = async (
    payload: { files: File[]; pasteTexts: { label?: string; content: string }[]; urls: string[] },
    appendCaseId?: string,
  ) => {
    try {
      const res = await extractMutation.mutateAsync({
        ...payload,
        pathway: pathwayId,
        caseId: appendCaseId,
      });
      setMatter(res.caseId, res.pathway);
      if (payload.files.length) addSourceFiles(payload.files);
      if (appendCaseId) await refetchCase();
      toast({
        title: appendCaseId ? t("tool.matter.toast.added") : t("tool.matter.toast.processed"),
        description: `${t("tool.matter.toast.addedPrefix")} ${res.documentCount} ${res.documentCount !== 1 ? t("tool.matter.toast.itemPlural") : t("tool.matter.toast.itemSingular")} ${t("tool.matter.toast.addedSuffix")}`,
      });
    } catch (e) {
      toast({
        title: t("tool.matter.toast.failed"),
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleRunStage = (stageId: IracStage) => {
    if (!caseId) return;
    streamStage.start(stageId, caseId, stageId === "issues" ? { pathway: pathwayId } : undefined);
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 flex flex-col gap-6">
      <JourneyStepper activeKey={caseData?.stages.issues ? "analyze" : "upload"} />

      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t("tool.matter.title")}</h1>
          {caseId ? (
            <p className="text-sm text-secondary font-medium mt-1">{t("tool.matter.matterId")} {caseId.slice(0, 8)}...</p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">{t("tool.matter.newMatter")}</p>
          )}
        </div>
        {caseId && (
          <Button variant="outline" onClick={() => setLocation("/drafting")}>
            {t("tool.matter.draftingStudio")} <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {!caseId ? (
        <Card className="border-border bg-card/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">{t("tool.matter.addMaterials.title")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("tool.matter.addMaterials.desc")}
            </p>
          </CardHeader>
          <CardContent>
            <CaseIntake onSubmit={(p) => handleIntake(p)} isSubmitting={extractMutation.isPending} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Sidebar / Case Details */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif">{t("tool.matter.caseFiles")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {caseData?.files.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="truncate text-foreground font-medium" title={f.name}>{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.chars / 1000).toFixed(1)}k {t("tool.matter.chars")} {f.truncated && t("tool.matter.truncated")}</p>
                      </div>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <p className="text-xs text-muted-foreground">
                    {t("tool.matter.total")} {(caseData?.totalChars || 0 / 1000).toFixed(1)}k {t("tool.matter.chars")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => setShowAddMore((v) => !v)}
                  >
                    {showAddMore ? (
                      <>{t("tool.matter.hide")}</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-1.5" /> {t("tool.matter.addMore")}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {showAddMore && (
              <Card className="bg-card border-primary/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-serif">{t("tool.matter.addMore.title")}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("tool.matter.addMore.desc")}
                  </p>
                </CardHeader>
                <CardContent>
                  <CaseIntake
                    mode="append"
                    isSubmitting={extractMutation.isPending}
                    onSubmit={async (p) => {
                      await handleIntake(p, caseId);
                      setShowAddMore(false);
                    }}
                  />
                </CardContent>
              </Card>
            )}

            <Card className="bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif">{t("tool.matter.pipeline")}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col">
                  {STAGES.map((s, i) => {
                    const isComplete = caseData?.stages[STAGE_KEY[s.id]];
                    const isActive = activeTab === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setActiveTab(s.id)}
                        className={`flex items-start gap-3 p-4 text-left transition-colors border-l-2
                          ${isActive ? 'bg-primary/5 border-primary' : 'border-transparent hover:bg-muted/50'}
                        `}
                      >
                        {isComplete ? (
                          <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                        ) : (
                          <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 ${isActive ? 'border-primary' : 'border-muted-foreground/30'}`} />
                        )}
                        <div>
                          <p className={`font-medium text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>
                            {i + 1}. {t(s.labelKey)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <Card className="h-[calc(100vh-12rem)] flex flex-col shadow-md border-border overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/20 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif text-xl text-foreground">
                      {(() => { const s = STAGES.find(s => s.id === activeTab); return s ? t(s.labelKey) : ""; })()}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(() => { const s = STAGES.find(s => s.id === activeTab); return s ? t(s.descKey) : ""; })()}
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleRunStage(activeTab)} 
                    disabled={streamStage.isStreaming}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {streamStage.isStreaming ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("tool.matter.processing")}</>
                    ) : (
                      <>{t("tool.matter.run")} {(() => { const s = STAGES.find(s => s.id === activeTab); return s ? t(s.labelKey) : ""; })()}</>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-6">
                
                {streamStage.error && (
                  <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-3 text-destructive">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{streamStage.error}</p>
                  </div>
                )}

                {/* Show streamed content if streaming or recently streamed */}
                {(streamStage.content || streamStage.isStreaming) ? (
                  <div className="animate-in fade-in duration-500">
                    <MarkdownRenderer content={streamStage.content} />
                    {streamStage.isStreaming && (
                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        {t("tool.matter.generating")}
                      </div>
                    )}
                    {!streamStage.isStreaming && streamStage.citations.length > 0 && (
                      <CitationsList citations={streamStage.citations} />
                    )}
                    {!streamStage.isStreaming && streamStage.disclaimer && (
                      <DisclaimerNotice
                        disclaimer={streamStage.disclaimer}
                        severe={streamStage.groundingWarning}
                      />
                    )}
                  </div>
                ) : (
                  /* Show cached content if available and not streaming */
                  caseData?.[STAGE_KEY[activeTab]] ? (
                    <div className="animate-in fade-in">
                       <MarkdownRenderer content={caseData[STAGE_KEY[activeTab]]!} />
                       {/* Note: In a real app we'd fetch citations for cached content too, but IRAC API state doesn't return them. */}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                      <Scale className="w-12 h-12 mb-4 opacity-20" />
                      <p>{t("tool.matter.empty.title")}</p>
                      <p className="text-sm mt-1">{t("tool.matter.empty.desc")}</p>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}
    </div>
  );
}
