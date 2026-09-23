import React, { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { usePathways, useCase } from "@/hooks/use-irac-api";
import { useStreamAnalyze } from "@/hooks/use-stream";
import { extractDocuments, CaseFileMeta } from "@/lib/irac-api";
import { useMatter } from "@/contexts/MatterContext";
import { useMatter as useLitMatter, fileWorkIntoMatter } from "@/hooks/use-matters";
import { FileUpload } from "@/components/FileUpload";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CitationsList } from "@/components/CitationsList";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScanSearch, Loader2, Copy, Check, FileText, RefreshCw, FolderOpen, FolderKanban, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import { ToolGuidance } from "@/components/ToolGuidance";

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

  // ── ?matter=<lit matter id> wiring ─────────────────────────────────────────
  const search = useSearch();
  const linkedMatterId = (() => {
    const v = new URLSearchParams(search).get("matter");
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const { data: linkedMatter } = useLitMatter(linkedMatterId);

  // Prefill instructions with matter context once loaded
  const [instructions, setInstructions] = useState<string>("");
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (linkedMatter && !prefilled) {
      const parts: string[] = [];
      if (linkedMatter.title) parts.push(`Matter: ${linkedMatter.title}`);
      if (linkedMatter.plaintiff && linkedMatter.defendant)
        parts.push(`Parties: ${linkedMatter.plaintiff} v ${linkedMatter.defendant}`);
      else if (linkedMatter.clientName)
        parts.push(`Client: ${linkedMatter.clientName}`);
      if (linkedMatter.court) parts.push(`Court: ${linkedMatter.court}`);
      if (linkedMatter.suitNo) parts.push(`Suit no: ${linkedMatter.suitNo}`);
      if (linkedMatter.matterType) parts.push(`Type: ${linkedMatter.matterType}`);
      if (parts.length > 0) {
        setInstructions(parts.join("\n"));
        setPrefilled(true);
      }
    }
  }, [linkedMatter, prefilled]);

  // ── Direct file-into-linked-matter save control ─────────────────────────────
  const qc = useQueryClient();
  const [savingToMatter, setSavingToMatter] = useState(false);
  const [savedToMatter, setSavedToMatter] = useState(false);

  const analyze = useStreamAnalyze();

  const hasActiveMatter = Boolean(activeCaseId && activeCase && activeCase.files.length > 0);

  const handleAnalyzeMatter = () => {
    if (!activeCaseId || !activeCase) return;
    const p = activeCase.pathway || activePathwayId || pathway;
    setAnalyzed({ caseId: activeCaseId, pathway: p, files: activeCase.files });
    analyze.start({ caseId: activeCaseId, pathway: p, matterContext: instructions.trim() || undefined });
  };

  const handleUpload = async (files: File[]) => {
    setIsUploading(true);
    try {
      const result = await extractDocuments({ files, pathway });
      setAnalyzed({ caseId: result.caseId, pathway, files: result.files });
      analyze.start({ caseId: result.caseId, pathway, matterContext: instructions.trim() || undefined });
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
    if (analyzed) analyze.start({ caseId: analyzed.caseId, pathway: analyzed.pathway, matterContext: instructions.trim() || undefined });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(analyze.content);
    setCopied(true);
    toast({ title: t("tool.analyzer.toast.copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToLinkedMatter = async () => {
    if (!linkedMatter || !analyze.content) return;
    setSavingToMatter(true);
    try {
      await fileWorkIntoMatter({
        kind: "irac-analysis",
        title: `IRAC Analysis — ${linkedMatter.title}`,
        matter: linkedMatter.title,
        matterId: linkedMatter.id,
        content: analyze.content,
      });
      qc.invalidateQueries({ queryKey: ["matters", "work", linkedMatter.id] });
      setSavedToMatter(true);
      toast({ title: "Filed into matter", description: `Saved to ${linkedMatter.title}.` });
    } catch (e) {
      toast({
        title: "Could not file into matter",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSavingToMatter(false);
    }
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
        <ToolGuidance kind="analyzer" />

        {/* Linked lit matter banner — shown when ?matter=<id> is present */}
        {linkedMatter && (
          <Card
            className="border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/5"
            data-testid="case-home-handoff-target"
            data-matter-id={linkedMatter.id}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-[hsl(var(--gold))] shrink-0" />
                  <span className="text-sm font-semibold text-foreground">Working in matter file</span>
                </div>
                <Link href={`/matters/${linkedMatter.id}`}>
                  <span className="text-xs text-[hsl(var(--gold))] hover:underline cursor-pointer">
                    <ArrowLeft className="inline w-3 h-3 mr-0.5" /> Back to file
                  </span>
                </Link>
              </div>
              <p className="text-sm font-medium text-foreground leading-snug">{linkedMatter.title}</p>
              {(linkedMatter.plaintiff || linkedMatter.clientName) && (
                <p className="text-xs text-muted-foreground">
                  {linkedMatter.plaintiff && linkedMatter.defendant
                    ? `${linkedMatter.plaintiff} v ${linkedMatter.defendant}`
                    : linkedMatter.clientName}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70">
                Analysis output can be filed directly into this matter.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Prefilled instructions from linked matter */}
        {linkedMatter && (
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Matter Context (editable)</CardTitle>
              <CardDescription className="text-xs">Pre-filled from your matter file. Edit as needed before analyzing.</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))] resize-none"
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Matter context…"
              />
            </CardContent>
          </Card>
        )}

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
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Direct file-into-linked-matter control */}
                {linkedMatter && (
                  savedToMatter ? (
                    <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                      <Check className="w-4 h-4" /> Filed into {linkedMatter.title}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10"
                      onClick={handleSaveToLinkedMatter}
                      disabled={savingToMatter}
                    >
                      {savingToMatter
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <FolderKanban className="w-4 h-4" />}
                      File into {linkedMatter.title.length > 20
                        ? linkedMatter.title.slice(0, 20) + "…"
                        : linkedMatter.title}
                    </Button>
                  )
                )}
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? t("common.copied") : t("tool.analyzer.copyText")}
                </Button>
              </div>
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
