import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMatter } from "@/contexts/MatterContext";
import { useCatalog, usePathways } from "@/hooks/use-irac-api";
import { useStreamDraft } from "@/hooks/use-stream";
import { extractDocuments, ExtractResult } from "@/lib/irac-api";
import { FileUpload } from "@/components/FileUpload";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CitationsList } from "@/components/CitationsList";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { JourneyStepper } from "@/components/JourneyStepper";
import { SaveToVault } from "@/components/SaveToVault";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquareReply, Loader2, Copy, Check, FileText, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Reply() {
  const { caseId, pathwayId, markReplied, sourceFiles } = useMatter();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: pathways } = usePathways();
  const [selectedPathway, setSelectedPathway] = useState<string>(pathwayId || "");
  const { data: catalog } = useCatalog(selectedPathway || null);

  const [category, setCategory] = useState<string>("");
  const [docType, setDocType] = useState<string>("");
  const [instructions, setInstructions] = useState<string>("");

  const [opponent, setOpponent] = useState<ExtractResult | null>(null);
  const [opponentFiles, setOpponentFiles] = useState<File[]>([]);
  const [isUploadingOpponent, setIsUploadingOpponent] = useState(false);

  const streamDraft = useStreamDraft();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!streamDraft.isStreaming && streamDraft.content && !streamDraft.error) {
      markReplied();
    }
  }, [streamDraft.isStreaming, streamDraft.content, streamDraft.error, markReplied]);

  const handleCopy = () => {
    navigator.clipboard.writeText(streamDraft.content);
    setCopied(true);
    toast({ title: t("tool.drafting.toast.copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpponentUpload = async (files: File[]) => {
    setIsUploadingOpponent(true);
    try {
      const result = await extractDocuments({ files, pathway: selectedPathway || "general-civil" });
      setOpponent(result);
      setOpponentFiles(files);
    } catch (e) {
      toast({
        title: t("tool.drafting.toast.uploadFailed"),
        description: e instanceof Error ? e.message : t("tool.drafting.toast.couldNotProcess"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingOpponent(false);
    }
  };

  const handleReply = () => {
    if (!selectedPathway) {
      toast({ title: t("tool.drafting.toast.selectPathway"), description: t("tool.drafting.toast.selectPathwayDesc"), variant: "destructive" });
      return;
    }
    if (!opponent) {
      toast({ title: t("tool.drafting.toast.noDocument"), description: t("tool.drafting.toast.noDocumentDesc"), variant: "destructive" });
      return;
    }
    streamDraft.start({
      pathway: selectedPathway,
      category,
      docType,
      mode: "reply",
      opponentCaseId: opponent.caseId,
      caseId: caseId || undefined,
      instructions: instructions || undefined,
    });
  };

  const docLabel = catalog?.categories.find((c) => c.id === category)?.items.find((i) => i.id === docType)?.label;
  const replyTitle = docLabel || t("save.default.reply");
  const replyFiles = [...sourceFiles, ...opponentFiles];

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-6 flex flex-col gap-6">
      <JourneyStepper activeKey="reply" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
              <MessageSquareReply className="w-8 h-8 text-primary" />
              {t("tool.reply.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">{t("tool.reply.desc")}</p>
          </div>

          {/* Opponent document */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif">{t("tool.reply.opponentTitle")}</CardTitle>
              <CardDescription>{t("tool.reply.opponentDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("tool.drafting.pathwayLabel")}</Label>
                <Select value={selectedPathway} onValueChange={(val) => { setSelectedPathway(val); setCategory(""); setDocType(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tool.drafting.selectPathway")} />
                  </SelectTrigger>
                  <SelectContent>
                    {pathways?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {opponent ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">{t("tool.drafting.reply.opponentDoc")}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground"
                      onClick={() => { setOpponent(null); setOpponentFiles([]); }}
                      disabled={streamDraft.isStreaming}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      {t("tool.drafting.reply.clear")}
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {opponent.files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{f.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <FileUpload
                  onUpload={handleOpponentUpload}
                  isUploading={isUploadingOpponent || streamDraft.isStreaming}
                  compact
                  title={t("tool.drafting.reply.dropTitle")}
                  buttonLabel={t("tool.drafting.reply.uploadButton")}
                />
              )}

              {isUploadingOpponent && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("tool.drafting.reply.extracting")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Optional: target a specific document type */}
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif">{t("tool.reply.targetTitle")}</CardTitle>
              <CardDescription>{t("tool.reply.targetDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("tool.drafting.categoryLabel")}</Label>
                <Select value={category} onValueChange={(val) => { setCategory(val); setDocType(""); }} disabled={!catalog}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tool.drafting.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog?.categories.map((c) => (
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
                    {catalog?.categories.find((c) => c.id === category)?.items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("tool.drafting.instructionsLabel")}</Label>
                <Textarea
                  placeholder={t("tool.drafting.instructionsPlaceholder")}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="resize-none h-24"
                />
              </div>

              <Button
                className="w-full justify-start text-left bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                onClick={handleReply}
                disabled={streamDraft.isStreaming || !opponent || !selectedPathway}
              >
                <MessageSquareReply className="w-4 h-4 mr-2" />
                {docType ? t("tool.drafting.reply.draftSelected") : t("tool.drafting.reply.draftSuitable")}
              </Button>
              {caseId ? (
                <p className="text-xs text-muted-foreground">{t("tool.drafting.reply.contextNote")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("tool.reply.noMatterNote")}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Output Area */}
        <div className="lg:col-span-8">
          <Card className="h-[calc(100vh-12rem)] flex flex-col shadow-md border-border bg-card">
            <CardHeader className="border-b border-border bg-card/80 backdrop-blur pb-3 flex flex-row items-center justify-between sticky top-0 z-10">
              <div>
                <CardTitle className="font-serif text-lg">{t("tool.reply.workspace")}</CardTitle>
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
                    kind="reply"
                    workLabel={t("save.label.reply")}
                    defaultTitle={replyTitle}
                    content={streamDraft.content}
                    sourceFiles={replyFiles}
                  />
                  <Button variant="ghost" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    {copied ? t("common.copied") : t("tool.drafting.copyText")}
                  </Button>
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
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 font-sans text-center">
                  <MessageSquareReply className="w-16 h-16 mb-4" />
                  <p>{t("tool.reply.empty")}</p>
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
