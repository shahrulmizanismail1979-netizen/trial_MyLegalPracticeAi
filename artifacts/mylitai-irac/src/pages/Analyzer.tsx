import React, { useState } from "react";
import { Link } from "wouter";
import { usePathways, useCase } from "@/hooks/use-irac-api";
import { useStreamAnalyze } from "@/hooks/use-stream";
import { extractDocuments, CaseFileMeta } from "@/lib/irac-api";
import { useMatter } from "@/contexts/MatterContext";
import { FileUpload } from "@/components/FileUpload";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CitationsList } from "@/components/CitationsList";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanSearch, Loader2, Copy, Check, FileText, RefreshCw, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

interface AnalyzedSource {
  caseId: string;
  pathway: string;
  files: CaseFileMeta[];
}

export default function Analyzer() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { caseId: activeCaseId, pathwayId: activePathwayId } = useMatter();
  const { data: activeCase } = useCase(activeCaseId);
  const { data: pathways } = usePathways();
  const [pathway, setPathway] = useState<string>("general-civil");
  const [analyzed, setAnalyzed] = useState<AnalyzedSource | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const analyze = useStreamAnalyze();

  const hasActiveMatter = Boolean(activeCaseId && activeCase && activeCase.files.length > 0);

  const handleAnalyzeMatter = () => {
    if (!activeCaseId || !activeCase) return;
    const p = activeCase.pathway || activePathwayId || pathway;
    setAnalyzed({ caseId: activeCaseId, pathway: p, files: activeCase.files });
    analyze.start(activeCaseId, p);
  };

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      const result = await extractDocuments({ files, pathway });
      setAnalyzed({ caseId: result.caseId, pathway, files: result.files });
      analyze.start(result.caseId, pathway);
    } catch (e) {
      toast({
        title: t("tool.analyzer.toast.uploadFailed"),
        description: e instanceof Error ? e.message : t("tool.analyzer.toast.couldNotProcess"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleReanalyze = () => {
    if (analyzed) analyze.start(analyzed.caseId, analyzed.pathway);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analyze.content);
    setCopied(true);
    toast({ title: t("tool.analyzer.toast.copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const showUploadCard = !hasActiveMatter || showUpload;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-6 gap-6 grid grid-cols-1 lg:grid-cols-12">
      {/* Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <ScanSearch className="w-8 h-8 text-primary" />
            {t("tool.analyzer.title")}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {t("tool.analyzer.desc")}
          </p>
        </div>

        {/* Active matter — analyze already-uploaded documents directly */}
        {hasActiveMatter && (
          <Card className="bg-card shadow-sm border-primary/40 ring-1 ring-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                {t("tool.analyzer.activeMatter.title")}
              </CardTitle>
              <CardDescription>{t("tool.analyzer.activeMatter.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  {t("tool.analyzer.activeMatter.files")}
                </h4>
                <ul className="space-y-1.5">
                  {activeCase!.files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="w-full"
                onClick={handleAnalyzeMatter}
                disabled={isUploading || analyze.isStreaming}
              >
                {analyze.isStreaming ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ScanSearch className="w-4 h-4 mr-2" />
                )}
                {t("tool.analyzer.activeMatter.button")}
              </Button>

              <div className="flex flex-col gap-1 text-xs">
                <Link
                  href="/matter"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  {t("tool.analyzer.activeMatter.addMore")}
                </Link>
                <button
                  type="button"
                  onClick={() => setShowUpload((v) => !v)}
                  className="text-left text-muted-foreground hover:text-primary transition-colors"
                >
                  {showUpload
                    ? t("tool.analyzer.hideDifferent")
                    : t("tool.analyzer.useDifferent")}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fresh upload — primary entry when there is no active matter, secondary otherwise */}
        {showUploadCard && (
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">
                {hasActiveMatter
                  ? t("tool.analyzer.differentTitle")
                  : t("tool.analyzer.upload")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("tool.analyzer.pathwayLabel")}</Label>
                <Select value={pathway} onValueChange={setPathway}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tool.analyzer.selectPathway")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pathways?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <FileUpload
                onUpload={handleUpload}
                isUploading={isUploading || analyze.isStreaming}
                title={t("tool.analyzer.dropTitle")}
                buttonLabel={t("tool.analyzer.analyzeButton")}
              />

              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("tool.analyzer.extracting")}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* What was analyzed + re-run */}
        {analyzed && !isUploading && (
          <Card className="bg-card shadow-sm border-border">
            <CardContent className="pt-6 space-y-3">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">
                  {t("tool.analyzer.sourceFiles")}
                </h4>
                <ul className="space-y-1.5">
                  {analyzed.files.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleReanalyze}
                disabled={analyze.isStreaming}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {t("tool.analyzer.reRun")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Output */}
      <div className="lg:col-span-8">
        <Card className="h-[calc(100vh-8rem)] flex flex-col shadow-md border-border bg-card">
          <CardHeader className="border-b border-border bg-card/80 backdrop-blur pb-3 flex flex-row items-center justify-between sticky top-0 z-10">
            <div>
              <CardTitle className="font-serif text-lg">{t("tool.analyzer.analysis")}</CardTitle>
              {analyze.isStreaming && (
                <CardDescription className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  {t("tool.analyzer.analyzing")}
                </CardDescription>
              )}
            </div>
            {analyze.content && !analyze.isStreaming && (
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? t("common.copied") : t("tool.analyzer.copyText")}
              </Button>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed">
            {analyze.error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md text-sm font-sans">
                {analyze.error}
              </div>
            )}

            {!analyze.content && !analyze.isStreaming && !analyze.error ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 font-sans">
                <ScanSearch className="w-16 h-16 mb-4" />
                <p>{hasActiveMatter ? t("tool.analyzer.emptyMatter") : t("tool.analyzer.empty")}</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500 max-w-3xl mx-auto">
                <MarkdownRenderer
                  content={analyze.content}
                  className="prose-lg prose-headings:text-foreground prose-p:text-foreground/90"
                />

                {analyze.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse align-middle" />
                )}

                {!analyze.isStreaming && analyze.citations.length > 0 && (
                  <div className="mt-12">
                    <CitationsList citations={analyze.citations} />
                  </div>
                )}

                {!analyze.isStreaming && analyze.disclaimer && (
                  <div className="mt-8 font-sans">
                    <DisclaimerNotice
                      disclaimer={analyze.disclaimer}
                      severe={analyze.groundingWarning}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
