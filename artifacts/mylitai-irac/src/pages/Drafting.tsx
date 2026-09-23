import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMatter } from "@/contexts/MatterContext";
import { extractTemplate } from "@/lib/irac-api";
import { useCatalog, usePathways } from "@/hooks/use-irac-api";
import { useStreamDraft } from "@/hooks/use-stream";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CitationsList } from "@/components/CitationsList";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { JourneyStepper } from "@/components/JourneyStepper";
import { SaveToVault } from "@/components/SaveToVault";
import { SaveToMatter } from "@/components/SaveToMatter";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PenTool, Copy, Check, FileText, MessageSquareReply, ArrowRight, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { ToolGuidance } from "@/components/ToolGuidance";

export default function Drafting() {
  const { caseId, pathwayId, markDrafted, sourceFiles } = useMatter();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  // If we came directly here, we might not have a pathway. Let user pick one.
  const { data: pathways } = usePathways();
  const [selectedPathway, setSelectedPathway] = useState<string>(pathwayId || "");
  const { data: catalog } = useCatalog(selectedPathway || null);

  const [category, setCategory] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");

  const [templateName, setTemplateName] = useState<string>("");
  const [templateText, setTemplateText] = useState<string>("");
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string>("");
  const templateInputRef = useRef<HTMLInputElement>(null);

  const streamDraft = useStreamDraft();
  const [copied, setCopied] = useState(false);

  const handleTemplateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setTemplateError("");
    setTemplateLoading(true);
    try {
      const result = await extractTemplate(file);
      setTemplateName(result.name);
      setTemplateText(result.text);
    } catch (err) {
      setTemplateError((err as Error).message || t("tool.drafting.template.error"));
      setTemplateName("");
      setTemplateText("");
    } finally {
      setTemplateLoading(false);
    }
  };

  const clearTemplate = () => {
    setTemplateName("");
    setTemplateText("");
    setTemplateError("");
  };

  useEffect(() => {
    if (!streamDraft.isStreaming && streamDraft.content && !streamDraft.error) {
      markDrafted();
    }
  }, [streamDraft.isStreaming, streamDraft.content, streamDraft.error, markDrafted]);

  const handleCopy = () => {
    navigator.clipboard.writeText(streamDraft.content);
    setCopied(true);
    toast({ title: t("tool.drafting.toast.copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = (mode: "sample" | "draft") => {
    if (!selectedPathway || !category || !docType) {
      toast({ title: t("tool.drafting.toast.missingFields"), description: t("tool.drafting.toast.missingFieldsDesc"), variant: "destructive" });
      return;
    }

    streamDraft.start({
      pathway: selectedPathway,
      category,
      docType,
      mode,
      caseId: mode === "draft" ? (caseId || undefined) : undefined,
      instructions: instructions || undefined,
      templateText: templateText || undefined,
    });
  };

  const docLabel = catalog?.categories.find((c) => c.id === category)?.items.find((i) => i.id === docType)?.label;
  const draftTitle = docLabel || t("save.default.draft");

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col gap-6">
      <JourneyStepper activeKey="draft" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
              <PenTool className="w-8 h-8 text-primary" />
              {t("tool.drafting.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              {t("tool.drafting.desc")}
            </p>
          </div>
          <ToolGuidance kind="drafting" />

          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">{t("tool.drafting.docSelection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-2">
                <Label>{t("tool.drafting.pathwayLabel")}</Label>
                <Select value={selectedPathway} onValueChange={(val) => { setSelectedPathway(val); setCategory(""); setDocType(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tool.drafting.selectPathway")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pathways?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("tool.drafting.categoryLabel")}</Label>
                <Select value={category} onValueChange={(val) => { setCategory(val); setDocType(""); }} disabled={!catalog}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tool.drafting.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog?.categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("tool.drafting.docTypeLabel")}</Label>
                <Select value={docType} onValueChange={setDocType} disabled={!category}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tool.drafting.selectDoc")} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog?.categories.find(c => c.id === category)?.items.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2">
                <Label>{t("tool.drafting.instructionsLabel")}</Label>
                <Textarea
                  placeholder={t("tool.drafting.instructionsPlaceholder")}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="resize-none h-24"
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label>{t("tool.drafting.template.label")}</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  {t("tool.drafting.template.hint")}
                </p>
                <input
                  ref={templateInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.rtf,.csv,image/*"
                  className="hidden"
                  onChange={handleTemplateChange}
                />
                {templateName ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10 px-3 py-2">
                    <span className="flex items-center gap-2 min-w-0 text-sm">
                      <FileText className="w-4 h-4 shrink-0 text-[hsl(var(--gold-bright))]" />
                      <span className="truncate">{templateName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={clearTemplate}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={t("tool.drafting.template.remove")}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left"
                    onClick={() => templateInputRef.current?.click()}
                    disabled={templateLoading}
                  >
                    {templateLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {templateLoading
                      ? t("tool.drafting.template.extracting")
                      : t("tool.drafting.template.upload")}
                  </Button>
                )}
                {templateError && (
                  <p className="text-xs text-destructive">{templateError}</p>
                )}
              </div>

              <div className="pt-4 space-y-3 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full justify-start text-left hover:bg-secondary/10 hover:text-secondary-foreground"
                  onClick={() => handleGenerate("sample")}
                  disabled={streamDraft.isStreaming || !docType}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {t("tool.drafting.generateSample")}
                </Button>

                <Button
                  className="w-full justify-start text-left bg-primary hover:bg-primary/90"
                  onClick={() => handleGenerate("draft")}
                  disabled={streamDraft.isStreaming || !docType || !caseId}
                >
                  <PenTool className="w-4 h-4 mr-2" />
                  {caseId ? t("tool.drafting.draftFromMatter") : t("tool.drafting.noMatter")}
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* Next step → Reply to the other side */}
          <Card className="bg-card shadow-sm border-border border-dashed">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--gold))]/10 ring-1 ring-[hsl(var(--gold))]/30">
                  <MessageSquareReply className="w-4 h-4 text-[hsl(var(--gold-bright))]" />
                </span>
                <div className="min-w-0">
                  <h4 className="font-serif text-sm text-foreground">{t("tool.drafting.next.title")}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("tool.drafting.next.desc")}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-3 justify-between hover:border-[hsl(var(--gold))]/60"
                onClick={() => setLocation("/reply")}
              >
                {t("home.step5.title")}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-8">
          <Card className="h-[calc(100vh-12rem)] flex flex-col shadow-md border-border bg-card">
            <CardHeader className="border-b border-border bg-card/80 backdrop-blur pb-3 flex flex-row items-center justify-between sticky top-0 z-10">
              <div>
                <CardTitle className="font-serif text-lg">{t("tool.drafting.workspace")}</CardTitle>
                {streamDraft.isStreaming && (
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    {t("tool.drafting.inProgress")}
                  </CardDescription>
                )}
              </div>
              {streamDraft.content && !streamDraft.isStreaming && (
                <div className="flex items-center gap-2">
                  <SaveToVault
                    kind="draft"
                    workLabel={t("save.label.draft")}
                    defaultTitle={draftTitle}
                    content={streamDraft.content}
                    sourceFiles={sourceFiles}
                  />
                  <SaveToMatter kind="draft" defaultTitle={draftTitle} content={streamDraft.content} />
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? t("common.copied") : t("tool.drafting.copyText")}
                  </Button>
                  <DraftExportButtons title={draftTitle} content={streamDraft.content} />
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-8 font-serif leading-relaxed">
              {streamDraft.error && (
                <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md text-sm font-sans">
                  {streamDraft.error}
                </div>
              )}

              {!streamDraft.content && !streamDraft.isStreaming && !streamDraft.error ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 font-sans">
                  <PenTool className="w-16 h-16 mb-4" />
                  <p>{t("tool.drafting.empty")}</p>
                </div>
              ) : (
                <div className="animate-in fade-in duration-500 max-w-3xl mx-auto">
                  <MarkdownRenderer
                    content={streamDraft.content}
                    className="prose-lg prose-headings:text-foreground prose-p:text-foreground/90 text-justify"
                  />

                  {streamDraft.isStreaming && (
                    <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse align-middle" />
                  )}

                  {!streamDraft.isStreaming && streamDraft.citations.length > 0 && (
                    <div className="mt-12">
                      <CitationsList citations={streamDraft.citations} />
                    </div>
                  )}

                  {!streamDraft.isStreaming && streamDraft.disclaimer && (
                    <div className="mt-8 font-sans">
                      <DisclaimerNotice
                        disclaimer={streamDraft.disclaimer}
                        severe={streamDraft.groundingWarning}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
