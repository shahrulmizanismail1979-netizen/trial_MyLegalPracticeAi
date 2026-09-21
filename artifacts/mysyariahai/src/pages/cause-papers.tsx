import { aiStreamFetch } from "@/lib/ai-stream-fetch";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ExportActions from "@/components/export-actions";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { DraftDocument } from "@workspace/draft-export/react";

export default function CausePapersPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [draftMode, setDraftMode] = useState(false);

  const { data: papers, isLoading } = useQuery({
    queryKey: ["cause-papers", gate, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      return api.causePapers.list(params);
    },
  });

  if (draftMode) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setDraftMode(false)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Cause Papers", "Kembali ke Kertas Kausa")}
        </Button>
        <AIDraftingPanel papers={papers || []} />
      </div>
    );
  }

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Cause Papers", "Kembali ke Kertas Kausa")}
        </Button>
        <CausePaperDetail paper={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            {t("Cause Papers", "Kertas Kausa")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "Templates and forms for Shariah court proceedings",
              "Templat dan borang untuk prosiding mahkamah Syariah"
            )}
          </p>
        </div>
        <Button
          onClick={() => setDraftMode(true)}
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shrink-0"
        >
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          {t("AI Paralegal Drafter", "Draf AI Paralegal")}
        </Button>
      </div>

      <Input
        placeholder={mode === "bm" ? "Cari kertas kausa..." : "Search cause papers..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {papers?.map((p: any) => (
            <Card key={p.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(p)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{mode === "bm" ? p.categoryBm : p.category}</Badge>
                  {p.formNumber && <Badge variant="secondary" className="text-xs">{p.formNumber}</Badge>}
                </div>
                <h3 className="font-serif font-semibold text-foreground text-sm">
                  {mode === "en" ? p.titleEn : mode === "bm" ? p.titleBm : `${p.titleBm} / ${p.titleEn}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {mode === "en" ? p.descriptionEn : p.descriptionBm}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CausePaperDetail({ paper: p }: { paper: any }) {
  const { t, ts, mode } = useLanguage();
  const [lang, setLang] = useState<"en" | "bm">(mode === "en" ? "en" : "bm");

  const handleCopyTemplate = () => {
    const text = lang === "bm" ? p.templateBm : p.templateEn;
    navigator.clipboard.writeText(text);
  };

  const handlePrint = () => {
    const text = lang === "bm" ? p.templateBm : p.templateEn;
    const title = lang === "bm" ? p.titleBm : p.titleEn;
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<html><head><title></title><style>body{font-family:'Courier New',monospace;font-size:12px;line-height:1.6;padding:40px;white-space:pre-wrap;}</style></head><body></body></html>`);
      printWindow.document.title = String(title);
      printWindow.document.body.textContent = String(text);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline">{mode === "bm" ? p.categoryBm : p.category}</Badge>
          {p.formNumber && <Badge variant="secondary">{p.formNumber}</Badge>}
        </div>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {mode === "en" ? p.titleEn : mode === "bm" ? p.titleBm : `${p.titleBm} / ${p.titleEn}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          {mode === "en" ? p.descriptionEn : p.descriptionBm}
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <h3 className="font-serif font-semibold text-sm">{t("Template", "Templat")}</h3>
          <div className="flex gap-1">
            <Button variant={lang === "bm" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setLang("bm")}>BM</Button>
            <Button variant={lang === "en" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setLang("en")}>EN</Button>
            <div className="w-px bg-border mx-1" />
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleCopyTemplate} title={ts("Copy", "Salin")}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handlePrint} title={ts("Print", "Cetak")}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-xs font-mono text-foreground/90 bg-muted/30 p-4 rounded-md border border-border/50 leading-relaxed">
            {lang === "bm" ? p.templateBm : p.templateEn}
          </pre>
        </CardContent>
      </Card>

      {p.requiredFields && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Required Fields", "Medan Diperlukan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex flex-wrap gap-1.5">
              {p.requiredFields.split(",").map((field: string) => (
                <Badge key={field} variant="outline" className="text-xs font-mono">{field.trim()}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AIDraftingPanel({ papers }: { papers: any[] }) {
  const { t, ts, mode } = useLanguage();
  const { gate } = useGate();
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [additionalContext, setAdditionalContext] = useState("");
  const [draftResult, setDraftResult] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState("");
  const draftEndRef = useRef<HTMLDivElement>(null);

  const API_BASE = "/api/sya";

  const handleSelectPaper = (paper: any) => {
    setSelectedPaper(paper);
    setFieldValues({});
    setDraftResult("");
    setDraftError("");
    setAdditionalContext("");
  };

  const requiredFields = selectedPaper?.requiredFields
    ? selectedPaper.requiredFields.split(",").map((f: string) => f.trim())
    : [];

  const fieldLabels: Record<string, { en: string; bm: string }> = {
    plaintiff_name: { en: "Plaintiff Name", bm: "Nama Plaintif" },
    defendant_name: { en: "Defendant Name", bm: "Nama Defendan" },
    applicant_name: { en: "Applicant Name", bm: "Nama Pemohon" },
    respondent_name: { en: "Respondent Name", bm: "Nama Responden" },
    wife_name: { en: "Wife Name", bm: "Nama Isteri" },
    husband_name: { en: "Husband Name", bm: "Nama Suami" },
    testator_name: { en: "Testator Name", bm: "Nama Pewasiat" },
    donor_name: { en: "Donor Name", bm: "Nama Pewakaf" },
    executor_name: { en: "Executor Name", bm: "Nama Wasi" },
    ic_number: { en: "IC Number", bm: "No. Kad Pengenalan" },
    case_number: { en: "Case Number", bm: "No. Kes" },
    court_name: { en: "Court Name", bm: "Nama Mahkamah" },
    court_location: { en: "Court Location", bm: "Lokasi Mahkamah" },
    hearing_date: { en: "Hearing Date", bm: "Tarikh Pendengaran" },
    marriage_date: { en: "Marriage Date", bm: "Tarikh Perkahwinan" },
    marriage_reg_no: { en: "Marriage Reg. No.", bm: "No. Daftar Perkahwinan" },
    claim_amount: { en: "Claim Amount (RM)", bm: "Jumlah Tuntutan (RM)" },
    claimed_amount: { en: "Claimed Amount (RM)", bm: "Jumlah Dituntut (RM)" },
    grounds: { en: "Grounds", bm: "Alasan" },
    cause_of_action: { en: "Cause of Action", bm: "Kausa Tindakan" },
    children_names: { en: "Children Names", bm: "Nama Anak-Anak" },
    children_ages: { en: "Children Ages", bm: "Umur Anak-Anak" },
    property_description: { en: "Property Description", bm: "Perihal Harta" },
    property_value: { en: "Property Value (RM)", bm: "Nilai Harta (RM)" },
    mahr_amount: { en: "Mahr Amount (RM)", bm: "Jumlah Mahar (RM)" },
    iwadh_details: { en: "Iwadh (Compensation) Details", bm: "Butiran Iwadh (Pampasan)" },
    reasons: { en: "Reasons", bm: "Alasan" },
    applicant_income: { en: "Applicant Income (RM)", bm: "Pendapatan Pemohon (RM)" },
    respondent_income: { en: "Respondent Income (RM)", bm: "Pendapatan Responden (RM)" },
    monthly_expenses: { en: "Monthly Expenses (RM)", bm: "Perbelanjaan Bulanan (RM)" },
    num_pronouncements: { en: "Number of Pronouncements", bm: "Bilangan Lafaz" },
    pronouncement_date: { en: "Pronouncement Date", bm: "Tarikh Lafaz" },
    place: { en: "Place", bm: "Tempat" },
    exact_words: { en: "Exact Words Used", bm: "Perkataan Tepat" },
    taklik_terms: { en: "Taklik Terms", bm: "Terma Taklik" },
    breach_details: { en: "Breach Details", bm: "Butiran Pelanggaran" },
    evidence: { en: "Evidence", bm: "Bukti" },
    bequests: { en: "Bequests Details", bm: "Butiran Wasiat" },
    witnesses: { en: "Witnesses", bm: "Saksi-Saksi" },
    order_date: { en: "Order Date", bm: "Tarikh Perintah" },
    order_terms: { en: "Order Terms", bm: "Terma Perintah" },
    non_compliance_details: { en: "Non-Compliance Details", bm: "Butiran Ketidakpatuhan" },
    service_date: { en: "Service Date", bm: "Tarikh Serahan" },
    appeal_date: { en: "Appeal Date", bm: "Tarikh Rayuan" },
    grounds_for_stay: { en: "Grounds for Stay", bm: "Alasan Penangguhan" },
    wakaf_type: { en: "Type of Wakaf", bm: "Jenis Wakaf" },
    purpose: { en: "Purpose", bm: "Tujuan" },
    form_number: { en: "Form Number", bm: "Nombor Borang" },
  };

  const getFieldLabel = (field: string) => {
    const label = fieldLabels[field];
    if (!label) return field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return mode === "bm" ? label.bm : mode === "en" ? label.en : `${label.bm} / ${label.en}`;
  };

  const isLargeField = (field: string) => {
    return ["grounds", "cause_of_action", "property_description", "reasons", "evidence", "bequests", "taklik_terms", "breach_details", "order_terms", "non_compliance_details", "grounds_for_stay", "exact_words", "purpose", "iwadh_details"].includes(field);
  };

  const handleDraft = async () => {
    if (!selectedPaper) return;
    setIsDrafting(true);
    setDraftResult("");

    try {
      const response = await aiStreamFetch(`${API_BASE}/cause-papers/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedPaper.id,
          templateTitleBm: selectedPaper.titleBm,
          templateTitleEn: selectedPaper.titleEn,
          templateBm: selectedPaper.templateBm,
          fieldValues,
          additionalContext,
          gate,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let content = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                content += data.content;
                setDraftResult(content);
              }
            } catch {}
          }
        }
      }

      draftEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      setDraftError(mode === "bm"
        ? "Ralat berlaku semasa menjana draf. Sila cuba lagi."
        : "An error occurred while generating the draft. Please try again."
      );
    } finally {
      setIsDrafting(false);
    }
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draftResult);
  };

  const handlePrintDraft = () => {
    const title = selectedPaper ? (mode === "bm" ? selectedPaper.titleBm : selectedPaper.titleEn) : "Draft";
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`<html><head><title></title><style>body{font-family:'Courier New',monospace;font-size:12px;line-height:1.6;padding:40px;white-space:pre-wrap;}</style></head><body></body></html>`);
      printWindow.document.title = String(title);
      printWindow.document.body.textContent = draftResult;
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {t("AI Paralegal Drafter", "Draf AI Paralegal")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Select a template, fill in the details, and let AI draft a complete cause paper for you in Bahasa Melayu.",
            "Pilih templat, isikan butiran, dan biarkan AI mendraf kertas kausa yang lengkap untuk anda dalam Bahasa Melayu."
          )}
        </p>
      </div>

      {!selectedPaper ? (
        <div className="space-y-3">
          <h3 className="font-serif font-semibold text-sm text-foreground">
            {t("Select Template / Pilih Templat", "Pilih Templat / Select Template")}
          </h3>
          <div className="grid gap-2 md:grid-cols-2">
            {papers.map((p: any) => (
              <Card
                key={p.id}
                className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors"
                onClick={() => handleSelectPaper(p)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{mode === "bm" ? p.categoryBm : p.category}</Badge>
                    {p.formNumber && <Badge variant="secondary" className="text-xs">{p.formNumber}</Badge>}
                  </div>
                  <h4 className="font-serif font-semibold text-foreground text-sm">
                    {mode === "en" ? p.titleEn : p.titleBm}
                  </h4>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="border-secondary/30 bg-secondary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="outline" className="text-xs mb-1">{mode === "bm" ? selectedPaper.categoryBm : selectedPaper.category}</Badge>
                  <h3 className="font-serif font-semibold text-foreground">
                    {mode === "en" ? selectedPaper.titleEn : selectedPaper.titleBm}
                  </h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedPaper(null); setDraftResult(""); }}>
                  {t("Change", "Tukar")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {requiredFields.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <h3 className="font-serif font-semibold text-sm">
                  {t("Fill in Details", "Isikan Butiran")}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t("Provide the case-specific information below.", "Berikan maklumat khusus kes di bawah.")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {requiredFields.map((field: string) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-foreground/80 mb-1 block">
                      {getFieldLabel(field)}
                    </label>
                    {isLargeField(field) ? (
                      <Textarea
                        value={fieldValues[field] || ""}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="text-sm min-h-[60px]"
                        placeholder={getFieldLabel(field)}
                      />
                    ) : (
                      <Input
                        value={fieldValues[field] || ""}
                        onChange={(e) => setFieldValues((prev) => ({ ...prev, [field]: e.target.value }))}
                        className="text-sm"
                        placeholder={getFieldLabel(field)}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <h3 className="font-serif font-semibold text-sm">
                {t("Additional Instructions (Optional)", "Arahan Tambahan (Pilihan)")}
              </h3>
            </CardHeader>
            <CardContent>
              <Textarea
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                placeholder={mode === "bm"
                  ? "Cth: Sertakan peruntukan s.52(1)(h) AUKI, nyatakan kekejaman mental dan fizikal, pohon nafkah RM3,000/bulan..."
                  : "E.g.: Include provisions s.52(1)(h) AUKI, state mental and physical cruelty, claim maintenance RM3,000/month..."
                }
                className="text-sm min-h-[80px]"
              />
            </CardContent>
          </Card>

          <Button
            onClick={handleDraft}
            disabled={isDrafting}
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
          >
            {isDrafting ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4m0 12v4m-7.07-3.93l2.83-2.83m8.48-8.48l2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83" />
                </svg>
                {t("AI is drafting...", "AI sedang mendraf...")}
              </span>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {t("Generate Draft / Jana Draf", "Jana Draf / Generate Draft")}
              </>
            )}
          </Button>

          {draftResult && (
            <Card className="border-secondary/30">
              <CardHeader className="pb-2 flex-row items-center justify-between">
                <h3 className="font-serif font-semibold text-sm text-secondary">
                  {t("AI-Generated Draft", "Draf Dijana AI")}
                </h3>
                {!isDrafting && !draftError && <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleCopyDraft} title={ts("Copy", "Salin")}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handlePrintDraft} title={ts("Print", "Cetak")}>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                  </Button>
                </div>}
              </CardHeader>
              <CardContent>
                {!isDrafting && !draftError && <ExportActions
                  content={draftResult}
                  filenameBase={selectedPaper ? (mode === "bm" ? selectedPaper.titleBm : selectedPaper.titleEn) : "draft"}
                  speechLang="ms-MY"
                  className="mb-3"
                />}
                <DraftDocument content={draftResult} />
                <p className="text-xs text-muted-foreground mt-3 italic border-t border-border/50 pt-3">
                  {t(
                    "This is an AI-generated draft. All content must be reviewed and verified by a qualified Peguam Syarie before filing.",
                    "Ini adalah draf yang dijana oleh AI. Semua kandungan mesti disemak dan disahkan oleh Peguam Syarie yang berkelayakan sebelum difailkan."
                  )}
                </p>
              </CardContent>
            </Card>
          )}
          {draftError && <p className="text-sm text-destructive">{draftError}</p>}
          {draftResult && !isDrafting && !draftError && (
            <SaveToMatterPanel
              draftTitle={selectedPaper ? (mode === "bm" ? selectedPaper.titleBm : selectedPaper.titleEn) : ts("AI Draft", "Draf AI")}
              draftContent={draftResult}
              kind="draft"
            />
          )}
          <div ref={draftEndRef} />
        </div>
      )}
    </div>
  );
}
