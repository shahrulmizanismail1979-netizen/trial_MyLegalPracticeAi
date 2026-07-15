import { useState } from "react";
import { useLanguage } from "@/lib/language-context";
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

const COURT_LEVELS = [
  { id: "lower", labelEn: "Shariah Subordinate Court (Mahkamah Rendah Syariah)", labelBm: "Mahkamah Rendah Syariah" },
  { id: "high", labelEn: "Shariah High Court (Mahkamah Tinggi Syariah)", labelBm: "Mahkamah Tinggi Syariah" },
  { id: "appeal", labelEn: "Shariah Court of Appeal (Mahkamah Rayuan Syariah)", labelBm: "Mahkamah Rayuan Syariah" },
];

const CASE_FEES: Record<string, { titleEn: string; titleBm: string; filingFee: number; court: string; serviceFee: number; stampFee: number; notes: string; notesBm: string; limitationMonths: number; limitationBasis: string }[]> = {
  "family": [
    { titleEn: "Marriage Registration", titleBm: "Pendaftaran Perkahwinan", filingFee: 10, court: "lower", serviceFee: 5, stampFee: 0, notes: "Application to Pendaftar Nikah Cerai Rujuk", notesBm: "Permohonan kepada Pendaftar Nikah Cerai Rujuk", limitationMonths: 0, limitationBasis: "No limitation" },
    { titleEn: "Divorce Application (Talaq)", titleBm: "Permohonan Cerai (Talaq)", filingFee: 50, court: "lower", serviceFee: 20, stampFee: 10, notes: "Filed by husband. Wife files Fasakh if refusing.", notesBm: "Difailkan oleh suami. Isteri failkan Fasakh jika menolak.", limitationMonths: 0, limitationBasis: "No limitation" },
    { titleEn: "Fasakh Application", titleBm: "Permohonan Fasakh", filingFee: 50, court: "lower", serviceFee: 20, stampFee: 10, notes: "Under s.52 Islamic Family Law Act. File in court where wife resides.", notesBm: "Di bawah s.52 Akta Undang-Undang Keluarga Islam. Failkan di mahkamah tempat isteri tinggal.", limitationMonths: 0, limitationBasis: "No limitation" },
    { titleEn: "Nafkah Claim", titleBm: "Tuntutan Nafkah", filingFee: 30, court: "lower", serviceFee: 20, stampFee: 10, notes: "Claim for wife/children maintenance. Can claim arrears up to 3 years.", notesBm: "Tuntutan nafkah isteri/anak. Boleh tuntut tunggakan sehingga 3 tahun.", limitationMonths: 36, limitationBasis: "ss.59-72 Akta 303 (established practice)" },
    { titleEn: "Hadhanah Application", titleBm: "Permohonan Hadhanah", filingFee: 50, court: "lower", serviceFee: 20, stampFee: 10, notes: "Custody application. Mother has priority for children under mumayyiz age.", notesBm: "Permohonan hak penjagaan. Ibu mempunyai keutamaan untuk anak di bawah umur mumayyiz.", limitationMonths: 0, limitationBasis: "No limitation" },
    { titleEn: "Mut'ah Claim", titleBm: "Tuntutan Mut'ah", filingFee: 30, court: "lower", serviceFee: 20, stampFee: 10, notes: "Consolatory gift claim on divorce. Amount based on husband's ability.", notesBm: "Tuntutan pemberian saguhati atas perceraian. Jumlah berdasarkan kemampuan suami.", limitationMonths: 36, limitationBasis: "3 years from divorce" },
    { titleEn: "Harta Sepencarian", titleBm: "Tuntutan Harta Sepencarian", filingFee: 100, court: "high", serviceFee: 30, stampFee: 20, notes: "Matrimonial property claim. Filed after divorce pronouncement.", notesBm: "Tuntutan harta sepencarian. Difailkan selepas cerai lafaz.", limitationMonths: 36, limitationBasis: "3 years from divorce" },
    { titleEn: "Polygamy Application", titleBm: "Permohonan Poligami", filingFee: 100, court: "lower", serviceFee: 20, stampFee: 10, notes: "Must prove financial ability, just treatment, necessity.", notesBm: "Mesti buktikan kemampuan kewangan, layanan adil, keperluan.", limitationMonths: 0, limitationBasis: "N/A" },
  ],
  "inheritance": [
    { titleEn: "Faraid Certificate Application", titleBm: "Permohonan Sijil Faraid", filingFee: 30, court: "lower", serviceFee: 10, stampFee: 5, notes: "Application for inheritance distribution certificate.", notesBm: "Permohonan sijil pengagihan harta pusaka.", limitationMonths: 0, limitationBasis: "No limitation" },
    { titleEn: "Wasiat Verification", titleBm: "Pengesahan Wasiat", filingFee: 50, court: "high", serviceFee: 20, stampFee: 10, notes: "Verification of Islamic will. Wasiat limited to 1/3 of estate.", notesBm: "Pengesahan wasiat Islam. Wasiat terhad kepada 1/3 harta pusaka.", limitationMonths: 0, limitationBasis: "No limitation" },
    { titleEn: "Hibah Verification", titleBm: "Pengesahan Hibah", filingFee: 50, court: "high", serviceFee: 20, stampFee: 10, notes: "Declaration of inter vivos gift. Must have delivery (qabd).", notesBm: "Perisytiharan hibah. Mesti ada penyerahan (qabd).", limitationMonths: 0, limitationBasis: "No limitation" },
  ],
  "enforcement": [
    { titleEn: "Enforcement of Court Order", titleBm: "Penguatkuasaan Perintah Mahkamah", filingFee: 30, court: "lower", serviceFee: 20, stampFee: 10, notes: "To enforce nafkah or other court orders.", notesBm: "Untuk menguatkuasakan nafkah atau perintah mahkamah lain.", limitationMonths: 12, limitationBasis: "Within 1 year of default" },
    { titleEn: "Contempt of Court Application", titleBm: "Permohonan Penghinaan Mahkamah", filingFee: 50, court: "high", serviceFee: 30, stampFee: 10, notes: "For non-compliance with court orders.", notesBm: "Untuk ketidakpatuhan terhadap perintah mahkamah.", limitationMonths: 0, limitationBasis: "No limitation" },
  ],
  "criminal": [
    { titleEn: "Khalwat (Close Proximity)", titleBm: "Khalwat", filingFee: 0, court: "lower", serviceFee: 0, stampFee: 0, notes: "Prosecution by state religious authority. Max fine RM3,000 or 2 years jail.", notesBm: "Pendakwaan oleh pihak berkuasa agama negeri. Denda maks RM3,000 atau 2 tahun penjara.", limitationMonths: 12, limitationBasis: "Akta 559/560 (general prosecution limitation)" },
    { titleEn: "Failure to Pay Zakat", titleBm: "Gagal Membayar Zakat", filingFee: 0, court: "lower", serviceFee: 0, stampFee: 0, notes: "Prosecution by Majlis Agama.", notesBm: "Pendakwaan oleh Majlis Agama.", limitationMonths: 12, limitationBasis: "1 year from offence" },
  ],
};

const TIMELINE_STEPS: Record<string, { stepEn: string; stepBm: string; daysMin: number; daysMax: number }[]> = {
  "divorce": [
    { stepEn: "File Application + Supporting Affidavit", stepBm: "Failkan Permohonan + Afidavit Sokongan", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration & Case Number", stepBm: "Pendaftaran Mahkamah & Nombor Kes", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Respondent", stepBm: "Penyampaian kepada Responden", daysMin: 7, daysMax: 21 },
    { stepEn: "Respondent's Reply (14 days)", stepBm: "Jawapan Responden (14 hari)", daysMin: 14, daysMax: 14 },
    { stepEn: "Sulh (Mediation) Session", stepBm: "Sesi Sulh (Mediasi)", daysMin: 14, daysMax: 30 },
    { stepEn: "First Mention", stepBm: "Sebutan Pertama", daysMin: 14, daysMax: 30 },
    { stepEn: "Trial (if contested)", stepBm: "Perbicaraan (jika dipertikaikan)", daysMin: 30, daysMax: 180 },
    { stepEn: "Judgment", stepBm: "Penghakiman", daysMin: 1, daysMax: 30 },
    { stepEn: "Certificate of Divorce (Surat Perakuan Cerai)", stepBm: "Surat Perakuan Cerai", daysMin: 7, daysMax: 14 },
  ],
  "nafkah": [
    { stepEn: "File Claim Statement", stepBm: "Failkan Pernyataan Tuntutan", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Defendant", stepBm: "Penyampaian kepada Defendan", daysMin: 7, daysMax: 21 },
    { stepEn: "Statement of Defence (14 days)", stepBm: "Pernyataan Pembelaan (14 hari)", daysMin: 14, daysMax: 14 },
    { stepEn: "Sulh Session", stepBm: "Sesi Sulh", daysMin: 14, daysMax: 30 },
    { stepEn: "Hearing / Trial", stepBm: "Pendengaran / Perbicaraan", daysMin: 30, daysMax: 90 },
    { stepEn: "Court Order", stepBm: "Perintah Mahkamah", daysMin: 1, daysMax: 14 },
  ],
  "fasakh": [
    { stepEn: "File Fasakh Application + Affidavit (s.52 IFLA)", stepBm: "Failkan Permohonan Fasakh + Afidavit (s.52 AUKI)", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration & Case Number", stepBm: "Pendaftaran Mahkamah & Nombor Kes", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Husband (Respondent)", stepBm: "Penyampaian kepada Suami (Responden)", daysMin: 7, daysMax: 21 },
    { stepEn: "Respondent's Reply (14 days)", stepBm: "Jawapan Responden (14 hari)", daysMin: 14, daysMax: 14 },
    { stepEn: "Sulh (Mediation) Session", stepBm: "Sesi Sulh (Mediasi)", daysMin: 14, daysMax: 30 },
    { stepEn: "First Mention", stepBm: "Sebutan Pertama", daysMin: 14, daysMax: 30 },
    { stepEn: "Trial & Proof of Grounds", stepBm: "Perbicaraan & Pembuktian Alasan", daysMin: 60, daysMax: 240 },
    { stepEn: "Judgment", stepBm: "Penghakiman", daysMin: 1, daysMax: 30 },
    { stepEn: "Certificate of Divorce (Fasakh)", stepBm: "Surat Perakuan Cerai (Fasakh)", daysMin: 7, daysMax: 14 },
  ],
  "hadhanah": [
    { stepEn: "File Custody Application", stepBm: "Failkan Permohonan Hadhanah", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Respondent", stepBm: "Penyampaian kepada Responden", daysMin: 7, daysMax: 21 },
    { stepEn: "Statement of Defence (14 days)", stepBm: "Pernyataan Pembelaan (14 hari)", daysMin: 14, daysMax: 14 },
    { stepEn: "Sulh Session", stepBm: "Sesi Sulh", daysMin: 14, daysMax: 30 },
    { stepEn: "Social Welfare / Child Welfare Report (if ordered)", stepBm: "Laporan Kebajikan Kanak-kanak (jika diarahkan)", daysMin: 14, daysMax: 45 },
    { stepEn: "Hearing / Trial", stepBm: "Pendengaran / Perbicaraan", daysMin: 30, daysMax: 120 },
    { stepEn: "Court Order", stepBm: "Perintah Mahkamah", daysMin: 1, daysMax: 21 },
  ],
  "mutah": [
    { stepEn: "File Mut'ah Claim", stepBm: "Failkan Tuntutan Mut'ah", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Former Husband", stepBm: "Penyampaian kepada Bekas Suami", daysMin: 7, daysMax: 21 },
    { stepEn: "Statement of Defence (14 days)", stepBm: "Pernyataan Pembelaan (14 hari)", daysMin: 14, daysMax: 14 },
    { stepEn: "Sulh Session", stepBm: "Sesi Sulh", daysMin: 14, daysMax: 30 },
    { stepEn: "Hearing (assess husband's ability)", stepBm: "Pendengaran (nilai kemampuan suami)", daysMin: 30, daysMax: 90 },
    { stepEn: "Court Order", stepBm: "Perintah Mahkamah", daysMin: 1, daysMax: 14 },
  ],
  "harta": [
    { stepEn: "File Harta Sepencarian Claim (Shariah High Court)", stepBm: "Failkan Tuntutan Harta Sepencarian (Mahkamah Tinggi Syariah)", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Respondent", stepBm: "Penyampaian kepada Responden", daysMin: 7, daysMax: 21 },
    { stepEn: "Statement of Defence (14 days)", stepBm: "Pernyataan Pembelaan (14 hari)", daysMin: 14, daysMax: 14 },
    { stepEn: "Sulh Session", stepBm: "Sesi Sulh", daysMin: 14, daysMax: 30 },
    { stepEn: "Discovery & Property Valuation", stepBm: "Pendedahan & Penilaian Harta", daysMin: 30, daysMax: 90 },
    { stepEn: "Trial", stepBm: "Perbicaraan", daysMin: 60, daysMax: 180 },
    { stepEn: "Judgment & Order", stepBm: "Penghakiman & Perintah", daysMin: 1, daysMax: 30 },
  ],
  "polygamy": [
    { stepEn: "File Polygamy Application + Supporting Documents", stepBm: "Failkan Permohonan Poligami + Dokumen Sokongan", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Notice to Existing Wife/Wives", stepBm: "Notis kepada Isteri Sedia Ada", daysMin: 7, daysMax: 21 },
    { stepEn: "Inquiry Hearing (ability, justice, necessity)", stepBm: "Pendengaran Siasatan (kemampuan, keadilan, keperluan)", daysMin: 30, daysMax: 90 },
    { stepEn: "Court Decision", stepBm: "Keputusan Mahkamah", daysMin: 1, daysMax: 21 },
    { stepEn: "Permission Order (if granted)", stepBm: "Perintah Kebenaran (jika diluluskan)", daysMin: 1, daysMax: 14 },
  ],
  "faraid": [
    { stepEn: "File Faraid Certificate Application", stepBm: "Failkan Permohonan Sijil Faraid", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Verification of Heirs & Estate Details", stepBm: "Pengesahan Waris & Butiran Harta Pusaka", daysMin: 7, daysMax: 30 },
    { stepEn: "Hearing", stepBm: "Pendengaran", daysMin: 14, daysMax: 45 },
    { stepEn: "Issuance of Faraid Certificate", stepBm: "Pengeluaran Sijil Faraid", daysMin: 7, daysMax: 21 },
  ],
  "enforcement": [
    { stepEn: "File Enforcement Application", stepBm: "Failkan Permohonan Penguatkuasaan", daysMin: 1, daysMax: 3 },
    { stepEn: "Court Registration", stepBm: "Pendaftaran Mahkamah", daysMin: 1, daysMax: 7 },
    { stepEn: "Service on Judgment Debtor", stepBm: "Penyampaian kepada Penghutang Penghakiman", daysMin: 7, daysMax: 21 },
    { stepEn: "Show-Cause Hearing", stepBm: "Pendengaran Tunjuk Sebab", daysMin: 14, daysMax: 45 },
    { stepEn: "Enforcement Order (garnishee / committal)", stepBm: "Perintah Penguatkuasaan (garnishee / komital)", daysMin: 1, daysMax: 30 },
  ],
};

const TIMELINE_OPTIONS: { value: string; labelEn: string; labelBm: string }[] = [
  { value: "divorce", labelEn: "Divorce Proceedings (Talaq)", labelBm: "Prosiding Perceraian (Talaq)" },
  { value: "fasakh", labelEn: "Fasakh Application", labelBm: "Permohonan Fasakh" },
  { value: "nafkah", labelEn: "Nafkah Claim", labelBm: "Tuntutan Nafkah" },
  { value: "hadhanah", labelEn: "Hadhanah (Custody) Application", labelBm: "Permohonan Hadhanah (Penjagaan)" },
  { value: "mutah", labelEn: "Mut'ah Claim", labelBm: "Tuntutan Mut'ah" },
  { value: "harta", labelEn: "Harta Sepencarian Claim", labelBm: "Tuntutan Harta Sepencarian" },
  { value: "polygamy", labelEn: "Polygamy Application", labelBm: "Permohonan Poligami" },
  { value: "faraid", labelEn: "Faraid Certificate Application", labelBm: "Permohonan Sijil Faraid" },
  { value: "enforcement", labelEn: "Enforcement of Court Order", labelBm: "Penguatkuasaan Perintah Mahkamah" },
];

export default function CourtToolsPage() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const [activeTab, setActiveTab] = useState<"fees" | "timeline">("fees");
  const [selectedCategory, setSelectedCategory] = useState("family");
  const [selectedTimeline, setSelectedTimeline] = useState("divorce");
  const [claimAmount, setClaimAmount] = useState("");

  const fees = CASE_FEES[selectedCategory] || [];
  const timeline = TIMELINE_STEPS[selectedTimeline] || [];

  const totalDaysMin = timeline.reduce((sum, s) => sum + s.daysMin, 0);
  const totalDaysMax = timeline.reduce((sum, s) => sum + s.daysMax, 0);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Court Tools", "Alat Mahkamah")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("Filing fees, limitation periods, and procedural timelines", "Yuran pemfailan, tempoh had, dan garis masa prosedur")}</p>
      </div>

      <div className="flex gap-2">
        <Button variant={activeTab === "fees" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("fees")} className={activeTab === "fees" ? "bg-secondary text-secondary-foreground" : ""}>
          {t("Filing Fees & Limitation", "Yuran Pemfailan & Had Masa")}
        </Button>
        <Button variant={activeTab === "timeline" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("timeline")} className={activeTab === "timeline" ? "bg-secondary text-secondary-foreground" : ""}>
          {t("Procedural Timeline", "Garis Masa Prosedur")}
        </Button>
      </div>

      {activeTab === "fees" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {Object.keys(CASE_FEES).map(cat => (
              <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className={selectedCategory === cat ? "bg-secondary/80 text-secondary-foreground" : ""}>
                {cat === "family" ? t("Family Law", "Undang-Undang Keluarga") :
                 cat === "inheritance" ? t("Inheritance", "Pewarisan") :
                 cat === "enforcement" ? t("Enforcement", "Penguatkuasaan") :
                 t("Criminal", "Jenayah")}
              </Button>
            ))}
          </div>

          <div className="space-y-3">
            {fees.map((fee, i) => {
              const courtLevel = COURT_LEVELS.find(c => c.id === fee.court);
              const totalFee = fee.filingFee + fee.serviceFee + fee.stampFee;
              return (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{mode === "bm" ? fee.titleBm : fee.titleEn}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{mode === "bm" ? courtLevel?.labelBm : courtLevel?.labelEn}</Badge>
                          {fee.limitationMonths > 0 && (
                            <Badge className="text-xs bg-amber-900/30 text-amber-400 border-amber-800">
                              {t(`Limitation: ${fee.limitationMonths} months`, `Had masa: ${fee.limitationMonths} bulan`)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{mode === "bm" ? fee.notesBm : fee.notes}</p>
                        {fee.limitationBasis !== "No limitation" && fee.limitationBasis !== "N/A" && (
                          <p className="text-xs text-secondary mt-0.5">{t("Basis", "Asas")}: {fee.limitationBasis}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-lg font-bold text-secondary font-mono">RM {totalFee}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          <p>{t("Filing", "Pemfailan")}: RM {fee.filingFee}</p>
                          <p>{t("Service", "Penyampaian")}: RM {fee.serviceFee}</p>
                          {fee.stampFee > 0 && <p>{t("Stamp", "Setem")}: RM {fee.stampFee}</p>}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground italic">{t("Fees shown are for Federal Territory (Wilayah Persekutuan). State courts may vary. Excludes legal professional fees.", "Yuran yang ditunjukkan untuk Wilayah Persekutuan. Mahkamah negeri mungkin berbeza. Tidak termasuk yuran profesional guaman.")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Case Type", "Jenis Kes")}</label>
            <Select value={selectedTimeline} onValueChange={setSelectedTimeline}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMELINE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{t(opt.labelEn, opt.labelBm)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card className="border-secondary/20">
            <CardHeader className="pb-3">
              <h2 className="font-serif font-semibold text-foreground">{t("Procedural Timeline", "Garis Masa Prosedur")}</h2>
              <p className="text-xs text-muted-foreground">{t(`Estimated total: ${totalDaysMin}-${totalDaysMax} days (${Math.ceil(totalDaysMin/30)}-${Math.ceil(totalDaysMax/30)} months)`, `Anggaran jumlah: ${totalDaysMin}-${totalDaysMax} hari (${Math.ceil(totalDaysMin/30)}-${Math.ceil(totalDaysMax/30)} bulan)`)}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {timeline.map((step, i) => {
                  const cumulativeMin = timeline.slice(0, i + 1).reduce((sum, s) => sum + s.daysMin, 0);
                  const cumulativeMax = timeline.slice(0, i + 1).reduce((sum, s) => sum + s.daysMax, 0);
                  return (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${i === timeline.length - 1 ? "bg-secondary text-secondary-foreground" : "bg-secondary/20 text-secondary"}`}>
                          {i + 1}
                        </div>
                        {i < timeline.length - 1 && <div className="w-0.5 h-full bg-border/50 my-1" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <h4 className="text-sm font-medium text-foreground">{mode === "bm" ? step.stepBm : step.stepEn}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{step.daysMin}-{step.daysMax} {t("days", "hari")}</span>
                          <span className="text-xs text-secondary/60">{t(`(Day ${cumulativeMin}-${cumulativeMax})`, `(Hari ${cumulativeMin}-${cumulativeMax})`)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/20">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground italic">{t("Timelines are estimates based on Federal Territory Shariah court procedures. Actual timelines vary based on court schedules, case complexity, and whether the case is contested.", "Garis masa adalah anggaran berdasarkan prosedur mahkamah Syariah Wilayah Persekutuan. Garis masa sebenar berbeza bergantung pada jadual mahkamah, kerumitan kes, dan sama ada kes dipertikaikan.")}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
