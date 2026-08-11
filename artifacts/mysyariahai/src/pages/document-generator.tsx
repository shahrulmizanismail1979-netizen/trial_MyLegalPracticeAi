import { aiStreamFetch } from "@/lib/ai-stream-fetch";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { useAuth } from "@/lib/auth-context";
import { tierHasFeature } from "@/lib/tiers";
import UpgradePrompt from "@/components/upgrade-prompt";
import ExportActions from "@/components/export-actions";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE = "/api/sya";

const FIELD_CONFIGS: Record<string, { labelEn: string; labelBm: string; placeholder: string; type?: string }[]> = {
  "nafkah-claim": [
    { labelEn: "Plaintiff Name (Wife)", labelBm: "Nama Plaintif (Isteri)", placeholder: "Siti Aminah binti Abdullah" },
    { labelEn: "Defendant Name (Husband)", labelBm: "Nama Defendan (Suami)", placeholder: "Ahmad bin Ibrahim" },
    { labelEn: "IC Number (Plaintiff)", labelBm: "No. KP (Plaintif)", placeholder: "880101-14-5678" },
    { labelEn: "IC Number (Defendant)", labelBm: "No. KP (Defendan)", placeholder: "850301-10-1234" },
    { labelEn: "Marriage Certificate No.", labelBm: "No. Sijil Nikah", placeholder: "WP 12345/2015" },
    { labelEn: "Number of Children", labelBm: "Bilangan Anak", placeholder: "3" },
    { labelEn: "Monthly Nafkah Claimed (RM)", labelBm: "Nafkah Bulanan Dituntut (RM)", placeholder: "3000" },
    { labelEn: "Husband's Occupation & Income", labelBm: "Pekerjaan & Pendapatan Suami", placeholder: "Engineer, RM8,000/month" },
    { labelEn: "Arrears Period (months)", labelBm: "Tempoh Tunggakan (bulan)", placeholder: "6" },
  ],
  "fasakh-application": [
    { labelEn: "Applicant Name (Wife)", labelBm: "Nama Pemohon (Isteri)", placeholder: "Fatimah binti Hassan" },
    { labelEn: "Respondent Name (Husband)", labelBm: "Nama Responden (Suami)", placeholder: "Mohd Razif bin Ali" },
    { labelEn: "Marriage Date", labelBm: "Tarikh Perkahwinan", placeholder: "15/03/2018" },
    { labelEn: "Grounds for Fasakh (s.52 AUKI)", labelBm: "Alasan Fasakh (s.52 AUKI)", placeholder: "Failure to maintain for 3+ months; cruelty" },
    { labelEn: "Details of Grounds", labelBm: "Butiran Alasan", placeholder: "Husband has not provided nafkah since January 2024...", type: "textarea" },
    { labelEn: "Supporting Evidence Available", labelBm: "Bukti Sokongan Tersedia", placeholder: "Bank statements, police report, medical records" },
  ],
  "hadhanah-application": [
    { labelEn: "Applicant Name", labelBm: "Nama Pemohon", placeholder: "Aishah binti Yusof" },
    { labelEn: "Respondent Name", labelBm: "Nama Responden", placeholder: "Kamal bin Ahmad" },
    { labelEn: "Children Names & Ages", labelBm: "Nama & Umur Anak-Anak", placeholder: "Adam (5 years), Sarah (3 years)" },
    { labelEn: "Current Custody Arrangement", labelBm: "Susunan Penjagaan Semasa", placeholder: "Children living with mother since separation" },
    { labelEn: "Reasons for Application", labelBm: "Sebab Permohonan", placeholder: "Mother is primary caregiver; stable home environment", type: "textarea" },
  ],
  "statement-of-defence": [
    { labelEn: "Defendant Name", labelBm: "Nama Defendan", placeholder: "Ahmad bin Ibrahim" },
    { labelEn: "Plaintiff Name", labelBm: "Nama Plaintif", placeholder: "Siti Aminah binti Abdullah" },
    { labelEn: "Case Number", labelBm: "No. Kes", placeholder: "14600-010-0123-2024" },
    { labelEn: "Plaintiff's Claim (summary)", labelBm: "Tuntutan Plaintif (ringkasan)", placeholder: "Plaintiff claims nafkah arrears of RM18,000...", type: "textarea" },
    { labelEn: "Admissions / Denials", labelBm: "Pengakuan / Penafian", placeholder: "Defendant admits paragraph 1-3, denies paragraph 4-7...", type: "textarea" },
    { labelEn: "Defendant's Version of Facts", labelBm: "Versi Fakta Defendan", placeholder: "Defendant has been paying RM2,000 monthly...", type: "textarea" },
  ],
  "interim-maintenance": [
    { labelEn: "Applicant Name", labelBm: "Nama Pemohon", placeholder: "Fatimah binti Hassan" },
    { labelEn: "Respondent Name", labelBm: "Nama Responden", placeholder: "Mohd Razif bin Ali" },
    { labelEn: "Case Number", labelBm: "No. Kes", placeholder: "14600-010-0123-2024" },
    { labelEn: "Interim Amount Sought (RM/month)", labelBm: "Jumlah Sementara Dituntut (RM/bulan)", placeholder: "2500" },
    { labelEn: "Urgency / Hardship", labelBm: "Kesegeraan / Kesusahan", placeholder: "No income; 3 young children; rent overdue", type: "textarea" },
  ],
  "variation-order": [
    { labelEn: "Applicant Name", labelBm: "Nama Pemohon", placeholder: "Ahmad bin Ibrahim" },
    { labelEn: "Respondent Name", labelBm: "Nama Responden", placeholder: "Siti Aminah binti Abdullah" },
    { labelEn: "Original Order (date & terms)", labelBm: "Perintah Asal (tarikh & terma)", placeholder: "Order dated 12/05/2022 — nafkah RM3,000/month", type: "textarea" },
    { labelEn: "Change in Circumstances", labelBm: "Perubahan Keadaan", placeholder: "Loss of employment; reduced income to RM2,000", type: "textarea" },
    { labelEn: "Variation Sought", labelBm: "Pengubahan Dituntut", placeholder: "Reduce nafkah to RM1,500/month", type: "textarea" },
  ],
  "wasiat-draft": [
    { labelEn: "Testator (Pewasiat) Name & IC", labelBm: "Nama & KP Pewasiat", placeholder: "Abdullah bin Omar, 600101-10-1234" },
    { labelEn: "Address", labelBm: "Alamat", placeholder: "No. 12, Jalan Mawar, 50000 Kuala Lumpur" },
    { labelEn: "Beneficiaries (non-heirs / 1/3 estate)", labelBm: "Penerima Wasiat (bukan waris / 1/3 harta)", placeholder: "Anak angkat: Zainab; Masjid Al-Hidayah", type: "textarea" },
    { labelEn: "Assets Bequeathed", labelBm: "Harta Diwasiatkan", placeholder: "RM50,000 cash; ASB units", type: "textarea" },
    { labelEn: "Executor (Wasi) Name", labelBm: "Nama Wasi (Pelaksana)", placeholder: "Ismail bin Abdullah" },
    { labelEn: "Witnesses (2)", labelBm: "Saksi (2)", placeholder: "Hassan bin Ali; Yusof bin Ahmad" },
  ],
  "hibah-deed": [
    { labelEn: "Donor (Pemberi Hibah) Name & IC", labelBm: "Nama & KP Pemberi Hibah", placeholder: "Abdullah bin Omar, 600101-10-1234" },
    { labelEn: "Donee (Penerima Hibah) Name & IC", labelBm: "Nama & KP Penerima Hibah", placeholder: "Aminah binti Abdullah, 900101-10-5678" },
    { labelEn: "Relationship", labelBm: "Hubungan", placeholder: "Daughter / Anak perempuan" },
    { labelEn: "Property Gifted (with details)", labelBm: "Harta Dihibahkan (dengan butiran)", placeholder: "House: Lot 123, Geran 4567, Mukim Petaling", type: "textarea" },
    { labelEn: "Delivery of Possession (Qabd)", labelBm: "Penyerahan Milikan (Qabd)", placeholder: "Keys and title handed over on 01/06/2026", type: "textarea" },
    { labelEn: "Witnesses (2)", labelBm: "Saksi (2)", placeholder: "Hassan bin Ali; Yusof bin Ahmad" },
  ],
  "wakalah-poa": [
    { labelEn: "Principal (Muwakkil) Name & IC", labelBm: "Nama & KP Pemberi Kuasa (Muwakkil)", placeholder: "Abdullah bin Omar, 600101-10-1234" },
    { labelEn: "Agent (Wakil) Name & IC", labelBm: "Nama & KP Wakil", placeholder: "Ismail bin Abdullah, 700101-10-2345" },
    { labelEn: "Scope of Authority", labelBm: "Skop Kuasa", placeholder: "Represent in Sulh proceedings; manage rental property", type: "textarea" },
    { labelEn: "Duration / Conditions", labelBm: "Tempoh / Syarat", placeholder: "Valid for 12 months; revocable in writing", type: "textarea" },
    { labelEn: "Witnesses (2)", labelBm: "Saksi (2)", placeholder: "Hassan bin Ali; Yusof bin Ahmad" },
  ],
  "faraid-distribution": [
    { labelEn: "Deceased (Si Mati) Name & IC", labelBm: "Nama & KP Si Mati", placeholder: "Omar bin Abdullah, 500101-10-1234" },
    { labelEn: "Date of Death", labelBm: "Tarikh Kematian", placeholder: "15/03/2026" },
    { labelEn: "Surviving Heirs (relationship)", labelBm: "Waris Yang Hidup (hubungan)", placeholder: "Wife; 2 sons; 1 daughter; mother", type: "textarea" },
    { labelEn: "Net Estate Value (RM)", labelBm: "Nilai Bersih Harta Pusaka (RM)", placeholder: "600000" },
    { labelEn: "Assets in Estate", labelBm: "Aset Dalam Harta Pusaka", placeholder: "House RM400,000; ASB RM150,000; EPF RM50,000", type: "textarea" },
  ],
  "plea-mitigation": [
    { labelEn: "Accused Name & IC", labelBm: "Nama & KP Tertuduh", placeholder: "Ahmad bin Ibrahim, 880101-14-5678" },
    { labelEn: "Charge & Provision", labelBm: "Pertuduhan & Peruntukan", placeholder: "Khalwat — s.27 Syariah Criminal Offences (Selangor)" },
    { labelEn: "Plea", labelBm: "Pengakuan", placeholder: "Guilty / Mengaku salah" },
    { labelEn: "Mitigating Factors", labelBm: "Faktor Peringanan", placeholder: "First offender; remorseful; sole breadwinner; cooperative", type: "textarea" },
    { labelEn: "Personal Circumstances", labelBm: "Keadaan Peribadi", placeholder: "Married, 2 children; earns RM2,500/month", type: "textarea" },
  ],
  "bail-application": [
    { labelEn: "Accused Name & IC", labelBm: "Nama & KP Tertuduh", placeholder: "Ahmad bin Ibrahim, 880101-14-5678" },
    { labelEn: "Charge & Provision", labelBm: "Pertuduhan & Peruntukan", placeholder: "s.7 Syariah Criminal Procedure offence" },
    { labelEn: "Grounds for Bail", labelBm: "Alasan Jaminan", placeholder: "Permanent address; no flight risk; willing surety", type: "textarea" },
    { labelEn: "Proposed Surety / Amount", labelBm: "Penjamin / Jumlah Dicadangkan", placeholder: "Father as surety; RM3,000 bail" },
  ],
  "notice-of-appeal": [
    { labelEn: "Appellant Name", labelBm: "Nama Perayu", placeholder: "Ahmad bin Ibrahim" },
    { labelEn: "Respondent Name", labelBm: "Nama Responden", placeholder: "Siti Aminah binti Abdullah" },
    { labelEn: "Case / Decision Appealed", labelBm: "Kes / Keputusan Dirayu", placeholder: "Judgment dated 10/06/2026, Case No. 14600-010-0123-2024" },
    { labelEn: "Court Appealed From", labelBm: "Mahkamah Dirayu Daripada", placeholder: "Mahkamah Tinggi Syariah Selangor" },
    { labelEn: "Grounds of Appeal", labelBm: "Alasan Rayuan", placeholder: "Misdirection on burden of proof; failure to consider evidence", type: "textarea" },
  ],
  "representation-letter": [
    { labelEn: "Accused Name & IC", labelBm: "Nama & KP Tertuduh", placeholder: "Ahmad bin Ibrahim, 880101-14-5678" },
    { labelEn: "Charge & Case Number", labelBm: "Pertuduhan & No. Kes", placeholder: "Khalwat; Case No. ..." },
    { labelEn: "Representation Sought", labelBm: "Representasi Dipohon", placeholder: "Withdrawal of charge / reduced charge / compound", type: "textarea" },
    { labelEn: "Grounds for Representation", labelBm: "Alasan Representasi", placeholder: "Weak evidence; first offender; public interest", type: "textarea" },
  ],
  "default": [
    { labelEn: "Party 1 Name", labelBm: "Nama Pihak 1", placeholder: "Name" },
    { labelEn: "Party 2 Name", labelBm: "Nama Pihak 2", placeholder: "Name" },
    { labelEn: "Case Number (if any)", labelBm: "No. Kes (jika ada)", placeholder: "14600-010-0001-2024" },
    { labelEn: "Key Facts / Details", labelBm: "Fakta / Butiran Utama", placeholder: "Describe the key facts and circumstances...", type: "textarea" },
    { labelEn: "Relief Sought", labelBm: "Remedi Yang Dituntut", placeholder: "Describe what relief is being sought", type: "textarea" },
  ],
};

export default function DocumentGeneratorPage() {
  const { user } = useAuth();
  if (!tierHasFeature(user?.tier, "aiToolkit")) {
    return (
      <UpgradePrompt
        requiredTier="professional"
        featureName="AI Document Generator"
        featureNameBm="Penjana Dokumen AI"
      />
    );
  }
  return <DocumentGeneratorPageInner />;
}

function DocumentGeneratorPageInner() {
  const { mode, ts } = useLanguage();
  const { gate } = useGate();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const [selectedType, setSelectedType] = useState("");
  const [docLanguage, setDocLanguage] = useState("bm");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generatedDoc, setGeneratedDoc] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: docTypes } = useQuery({
    queryKey: ["doc-types"],
    queryFn: async () => {
      const res = await aiStreamFetch(`${API_BASE}/document-generator/types`, { credentials: "include" });
      return res.json();
    },
  });

  const fields = FIELD_CONFIGS[selectedType] || FIELD_CONFIGS["default"];
  const currentDocType = Array.isArray(docTypes) ? docTypes.find((d: any) => d.id === selectedType) : undefined;
  const visibleDocTypes = Array.isArray(docTypes)
    ? (gate ? docTypes.filter((d: any) => !d.gates || String(d.gates).split(",").includes(gate)) : docTypes)
    : [];

  useEffect(() => {
    if (selectedType && !visibleDocTypes.some((d: any) => d.id === selectedType)) {
      setSelectedType("");
      setFieldValues({});
      setGeneratedDoc("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, docTypes]);

  const handleGenerate = async () => {
    if (!selectedType) return;
    setGenerating(true);
    setError("");
    setGeneratedDoc("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await aiStreamFetch(`${API_BASE}/document-generator/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: selectedType, language: docLanguage, details: fieldValues, gate }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      let fullText = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.error) { setError(data.error); break; }
            if (data.content) { fullText += data.content; setGeneratedDoc(fullText); }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const categoryColors: Record<string, string> = {
    pleading: "bg-blue-900/30 text-blue-400 border-blue-800",
    affidavit: "bg-violet-900/30 text-violet-400 border-violet-800",
    letter: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
    settlement: "bg-amber-900/30 text-amber-400 border-amber-800",
    submission: "bg-cyan-900/30 text-cyan-400 border-cyan-800",
    appeal: "bg-sky-900/30 text-sky-400 border-sky-800",
    criminal: "bg-rose-900/30 text-rose-400 border-rose-800",
    instrument: "bg-teal-900/30 text-teal-400 border-teal-800",
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Document Generator", "Penjana Dokumen")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("AI-powered legal document drafting for Shariah court proceedings", "Penjanaan draf dokumen undang-undang berkuasa AI untuk prosiding mahkamah Syariah")}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-semibold text-foreground">{t("Document Type", "Jenis Dokumen")}</h2>
                <span className="text-xs text-muted-foreground">{t(`${visibleDocTypes.length} templates`, `${visibleDocTypes.length} templat`)}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                {visibleDocTypes.map((dt: any) => (
                  <div
                    key={dt.id}
                    onClick={() => { setSelectedType(dt.id); setFieldValues({}); setGeneratedDoc(""); }}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedType === dt.id ? "border-secondary bg-secondary/5" : "border-border/50 hover:border-secondary/30"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${categoryColors[dt.category] || "bg-muted"}`}>{dt.category}</Badge>
                      <span className="text-sm font-medium text-foreground">{mode === "bm" ? dt.titleBm : dt.titleEn}</span>
                    </div>
                  </div>
                ))}
                {visibleDocTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {t("No templates for this practice gate yet.", "Tiada templat untuk gerbang amalan ini lagi.")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedType && (
            <Card>
              <CardHeader className="pb-3"><h2 className="font-serif font-semibold text-foreground">{t("Case Details", "Butiran Kes")}</h2></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Document Language", "Bahasa Dokumen")}</label>
                  <Select value={docLanguage} onValueChange={setDocLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bm">Bahasa Melayu</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {fields.map((f, i) => (
                  <div key={i}>
                    <label className="text-sm font-medium text-foreground mb-1.5 block">{mode === "bm" ? f.labelBm : f.labelEn}</label>
                    {f.type === "textarea" ? (
                      <textarea
                        value={fieldValues[f.labelEn] || ""}
                        onChange={e => setFieldValues(prev => ({ ...prev, [f.labelEn]: e.target.value }))}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder={f.placeholder}
                      />
                    ) : (
                      <Input
                        value={fieldValues[f.labelEn] || ""}
                        onChange={e => setFieldValues(prev => ({ ...prev, [f.labelEn]: e.target.value }))}
                        placeholder={f.placeholder}
                      />
                    )}
                  </div>
                ))}
                <Button onClick={handleGenerate} disabled={generating} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                  {generating ? t("Generating Document...", "Menjana Dokumen...") : t("Generate Document", "Jana Dokumen")}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          {error && <Card className="border-destructive/30 mb-4"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

          {generatedDoc ? (
            <Card className="border-secondary/30">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                  <h2 className="font-serif font-semibold text-secondary">{t("Generated Document", "Dokumen Yang Dijana")}</h2>
                  {!generating && (
                    <ExportActions
                      content={generatedDoc}
                      filenameBase={currentDocType ? (mode === "bm" ? currentDocType.titleBm : currentDocType.titleEn) : "document"}
                      speechLang={docLanguage === "bm" ? "ms-MY" : "en-US"}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white/5 rounded-lg p-4 prose prose-sm prose-invert max-w-none overflow-auto max-h-[70vh]">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{generatedDoc}</pre>
                </div>
                <p className="text-xs text-muted-foreground italic mt-3">
                  {t("This is an AI-generated draft. Review and amend before filing.", "Ini adalah draf yang dijana AI. Semak dan pinda sebelum memfailkan.")}
                </p>
                {!generating && (
                  <div className="mt-3">
                    <SaveToMatterPanel
                      draftTitle={currentDocType ? (mode === "bm" ? currentDocType.titleBm : currentDocType.titleEn) : ts("Generated Document", "Dokumen Dijana")}
                      draftContent={generatedDoc}
                      kind="document"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <h3 className="font-serif font-semibold text-foreground mb-2">{t("AI Document Drafting", "Penjanaan Dokumen AI")}</h3>
                <p className="text-sm text-muted-foreground">{t("Select a document type and fill in the details. AI will generate a professional, court-ready legal document.", "Pilih jenis dokumen dan isi butiran. AI akan menjana dokumen undang-undang profesional yang sedia untuk mahkamah.")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
