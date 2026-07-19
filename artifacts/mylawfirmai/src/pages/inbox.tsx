import { useState } from "react";
import {
  useIngestScreenshot,
  useIngestGmail,
  useIngestDocument,
  type IngestResponse,
} from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { DraftReview } from "@/components/DraftReview";
import { useT, useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { fileToBase64 } from "@/hooks/useRecorder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ImageUp, Mail, Info, FileText } from "lucide-react";
import { toast } from "sonner";

export default function InboxPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { currentUser } = useAuth();
  const ingestScreenshot = useIngestScreenshot();
  const ingestGmail = useIngestGmail();
  const ingestDocument = useIngestDocument();
  const [result, setResult] = useState<IngestResponse | null>(null);

  const handleScreenshot = async (file: File) => {
    setResult(null);
    try {
      const imageBase64 = await fileToBase64(file);
      ingestScreenshot.mutate(
        {
          data: {
            imageBase64,
            mimeType: file.type || "image/png",
            lang,
            actingUserId: currentUser?.id ?? 0,
          },
        },
        {
          onSuccess: (res) => setResult(res),
          onError: () => toast.error(t("inbox.error")),
        },
      );
    } catch {
      toast.error(t("inbox.error"));
    }
  };

  const handleGmail = () => {
    setResult(null);
    ingestGmail.mutate(
      { data: { lang, max: 10, actingUserId: currentUser?.id ?? 0 } },
      {
        onSuccess: (res) => setResult(res),
        onError: () => toast.error(t("inbox.error")),
      },
    );
  };

  const handleDocument = async (file: File) => {
    setResult(null);
    try {
      const fileBase64 = await fileToBase64(file);
      ingestDocument.mutate(
        {
          data: {
            fileBase64,
            mimeType: file.type || "application/octet-stream",
            filename: file.name,
            lang,
            actingUserId: currentUser?.id ?? 0,
          },
        },
        {
          onSuccess: (res) => setResult(res),
          onError: () => toast.error(t("inbox.error")),
        },
      );
    } catch {
      toast.error(t("inbox.error"));
    }
  };

  const pending =
    ingestScreenshot.isPending || ingestGmail.isPending || ingestDocument.isPending;

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-8">
        <header className="mb-8">
          <h1 className="jewel-gradient-text font-serif text-4xl font-bold tracking-tight">
            {t("inbox.title")}
          </h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            {t("inbox.subtitle")}
          </p>
        </header>

        <Tabs
          defaultValue="screenshot"
          onValueChange={() => setResult(null)}
        >
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="screenshot">{t("inbox.tab.screenshot")}</TabsTrigger>
            <TabsTrigger value="document">{t("inbox.tab.document")}</TabsTrigger>
            <TabsTrigger value="gmail">{t("inbox.tab.gmail")}</TabsTrigger>
          </TabsList>

          <TabsContent value="screenshot" className="pt-6">
            <Card className="glass-card border-border/60 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ImageUp className="h-4 w-4" />
                {t("inbox.screenshot.hint")}
              </div>
              <Input
                type="file"
                accept="image/*"
                disabled={pending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleScreenshot(f);
                }}
              />
              {ingestScreenshot.isPending && (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("inbox.screenshot.processing")}
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="document" className="pt-6">
            <Card className="glass-card border-border/60 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {t("inbox.document.hint")}
              </div>
              <Input
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                disabled={pending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleDocument(f);
                }}
              />
              {ingestDocument.isPending && (
                <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("inbox.document.processing")}
                </p>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="gmail" className="pt-6">
            <Card className="glass-card border-border/60 p-6">
              <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {t("inbox.gmail.hint")}
              </div>
              <Button onClick={handleGmail} disabled={pending} className="gap-2">
                {ingestGmail.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("inbox.gmail.syncing")}
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    {t("inbox.gmail.sync")}
                  </>
                )}
              </Button>
            </Card>
          </TabsContent>
        </Tabs>

        {result && (
          <div className="mt-8 space-y-4">
            {result.note && (
              <p className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{t("inbox.note")}:</strong> {result.note}
                </span>
              </p>
            )}
            <DraftReview drafts={result.drafts} onCreated={() => setResult(null)} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
