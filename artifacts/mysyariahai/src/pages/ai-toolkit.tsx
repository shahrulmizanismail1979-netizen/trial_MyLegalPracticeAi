import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Gate = "civil" | "criminal" | "advisory";

interface Tool {
  path: string;
  titleEn: string;
  titleBm: string;
  whenEn: string;
  whenBm: string;
  gates: Gate[] | "all";
  highlighted?: boolean;
}

interface Group {
  titleEn: string;
  titleBm: string;
  descEn: string;
  descBm: string;
  accent: string;
  tools: Tool[];
}

const GROUPS: Group[] = [
  {
    titleEn: "Case Workspace",
    titleBm: "Ruang Kerja Kes",
    descEn: "Type your facts once and run the three core scenario analyses together.",
    descBm: "Taipkan fakta anda sekali dan jalankan tiga analisis senario teras serentak.",
    accent: "border-secondary/40 bg-secondary/5",
    tools: [
      {
        path: "/case-workspace",
        titleEn: "Case Workspace (recommended starting point)",
        titleBm: "Ruang Kerja Kes (titik mula yang disyorkan)",
        whenEn: "Whenever you have a new matter and want cross-references + precedent prediction + a draft opinion from one input.",
        whenBm: "Bila-bila masa anda ada perkara baru dan mahukan rujukan silang + ramalan duluan + draf pendapat daripada satu input.",
        gates: "all",
        highlighted: true,
      },
      {
        path: "/client-intake",
        titleEn: "Client Intake Assistant",
        titleBm: "Pembantu Pengambilan Klien",
        whenEn: "Use a structured intake form (Nafkah, Fasakh, Hadhanah). The generated brief can be opened straight into the Case Workspace.",
        whenBm: "Gunakan borang pengambilan berstruktur (Nafkah, Fasakh, Hadhanah). Ringkasan yang dijana boleh dibuka terus ke Ruang Kerja Kes.",
        gates: ["civil", "criminal", "advisory"],
      },
    ],
  },
  {
    titleEn: "Research the Sources",
    titleBm: "Cari Sumber",
    descEn: "Find the primary materials — verses, fatwas, statutes, case law, and classical kitab.",
    descBm: "Cari bahan utama — ayat, fatwa, statut, kes, dan kitab klasik.",
    accent: "border-emerald-700/30 bg-emerald-50/40 dark:bg-emerald-950/10",
    tools: [
      {
        path: "/smart-search",
        titleEn: "Smart Search",
        titleBm: "Carian Pintar",
        whenEn: "You know roughly what you're looking for and want a single ranked list across all source types.",
        whenBm: "Anda tahu secara umum apa yang dicari dan mahukan senarai berkedudukan merentas semua jenis sumber.",
        gates: ["civil", "criminal", "advisory"],
      },
      {
        path: "/ai-counsel",
        titleEn: "AI Counsel (Peguam Kanan Syarie)",
        titleBm: "AI Peguam Kanan Syarie",
        whenEn: "You want to chat through a question conversationally and follow up.",
        whenBm: "Anda mahu berbual tentang soalan dan menyusul dengan soalan tambahan.",
        gates: ["civil", "criminal", "advisory"],
      },
      {
        path: "/kitab",
        titleEn: "Kitab Reference & Analysis",
        titleBm: "Rujukan & Analisis Kitab",
        whenEn: "You need the classical fiqh position from named kitab (Mughni, Mudawwanah, etc.) before applying it to a Malaysian context.",
        whenBm: "Anda perlukan kedudukan fiqh klasik daripada kitab tertentu sebelum menerapkannya dalam konteks Malaysia.",
        gates: ["advisory"],
      },
      {
        path: "/tafsir",
        titleEn: "AI Tafsir Al-Quran",
        titleBm: "Tafsir AI Al-Quran",
        whenEn: "You need to understand a specific ayah — including ahkam, asbab al-nuzul, or its application in Malaysian Shariah practice.",
        whenBm: "Anda perlu memahami ayat tertentu — termasuk ahkam, asbab al-nuzul, atau penerapannya dalam amalan Syariah Malaysia.",
        gates: ["civil", "criminal", "advisory"],
      },
    ],
  },
  {
    titleEn: "Analyse the Case",
    titleBm: "Analisis Kes",
    descEn: "Already in the Case Workspace? These are the same engines, available standalone if you only need one.",
    descBm: "Sudah berada dalam Ruang Kerja Kes? Ini adalah enjin yang sama, tersedia secara berasingan jika anda hanya perlukan satu.",
    accent: "border-amber-700/30 bg-amber-50/40 dark:bg-amber-950/10",
    tools: [
      {
        path: "/analyzer",
        titleEn: "AI Analyzer — Cross-References",
        titleBm: "Penganalisis AI — Rujukan Silang",
        whenEn: "Quickly pull every relevant verse, fatwa, provision, and case for a fact pattern.",
        whenBm: "Tarik dengan cepat setiap ayat, fatwa, peruntukan, dan kes yang berkaitan untuk sesuatu fakta.",
        gates: ["civil", "criminal", "advisory"],
      },
      {
        path: "/case-analysis",
        titleEn: "Case Analysis & Prediction",
        titleBm: "Analisis & Ramalan Kes",
        whenEn: "Get a strength assessment (1–10) and likely outcome based on similar precedent.",
        whenBm: "Dapatkan penilaian kekuatan (1–10) dan kemungkinan keputusan berdasarkan duluan serupa.",
        gates: ["civil", "criminal"],
      },
      {
        path: "/legal-opinion",
        titleEn: "Legal Opinion Writer",
        titleBm: "Penulis Pendapat Undang-Undang",
        whenEn: "Draft a formal Pendapat Undang-Undang (Issues / Applicable Law / Analysis / Conclusion) for a client.",
        whenBm: "Drafkan Pendapat Undang-Undang formal (Isu / Undang-undang Berkaitan / Analisis / Kesimpulan) untuk klien.",
        gates: ["advisory"],
      },
      {
        path: "/compliance-check",
        titleEn: "Shariah Compliance Check",
        titleBm: "Semakan Pematuhan Syariah",
        whenEn: "Specifically for transactions / contracts (Murabahah, Hibah, etc.) — flags Riba, Gharar, Maysir.",
        whenBm: "Khusus untuk transaksi / kontrak (Murabahah, Hibah, dll.) — kesan Riba, Gharar, Maysir.",
        gates: ["advisory"],
      },
    ],
  },
  {
    titleEn: "Draft & File",
    titleBm: "Drafkan & Failkan",
    descEn: "Produce court-ready papers and prepare for hearing.",
    descBm: "Sediakan kertas mahkamah dan persiapan perbicaraan.",
    accent: "border-rose-700/30 bg-rose-50/40 dark:bg-rose-950/10",
    tools: [
      {
        path: "/cause-papers",
        titleEn: "Cause Papers AI Drafter",
        titleBm: "Pendraf AI Kertas Kausa",
        whenEn: "You have a specific cause-paper template (saman, afidavit, notis) and want it filled and expanded.",
        whenBm: "Anda ada templat kertas kausa tertentu (saman, afidavit, notis) dan mahu ia diisi serta diperkembang.",
        gates: ["civil", "criminal"],
      },
      {
        path: "/document-generator",
        titleEn: "General Document Generator",
        titleBm: "Penjana Dokumen Umum",
        whenEn: "You need a document that isn't covered by the cause-paper templates (letters, applications, generic pleadings).",
        whenBm: "Anda memerlukan dokumen yang tidak diliputi oleh templat kertas kausa (surat, permohonan, pleading umum).",
        gates: ["civil", "criminal", "advisory"],
      },
      {
        path: "/voice-mode",
        titleEn: "Voice Mode — Court Practice",
        titleBm: "Mod Suara — Latihan Mahkamah",
        whenEn: "Rehearse oral submission, examination, cross-examination, or bench Q&A out loud before hearing day.",
        whenBm: "Berlatih hujahan lisan, pemeriksaan, pemeriksaan balas, atau soal jawab dengan hakim sebelum hari perbicaraan.",
        gates: ["civil", "criminal"],
      },
    ],
  },
];

export default function AIToolkitPage() {
  const { mode } = useLanguage();
  const { gate } = useGate();
  const [, setLocation] = useLocation();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const visible = (g: Tool["gates"]) => {
    if (g === "all") return true;
    if (!gate) return true;
    return (g as Gate[]).includes(gate as Gate);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="ai-toolkit-title">
          {t("AI Toolkit", "Kit Alat AI")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
          {t(
            "All twelve AI features grouped by what you're trying to do. Start in the Case Workspace if you have a new matter — it bundles the three most common analyses into one input.",
            "Kesemua dua belas ciri AI dikumpulkan mengikut tujuan anda. Mulakan di Ruang Kerja Kes jika anda ada perkara baru — ia menggabungkan tiga analisis paling biasa ke dalam satu input."
          )}
        </p>
      </div>

      <div className="space-y-6">
        {GROUPS.map((group, gi) => (
          <Card key={gi} className={group.accent}>
            <CardHeader>
              <h2 className="text-xl font-semibold">{mode === "bm" ? group.titleBm : group.titleEn}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{mode === "bm" ? group.descBm : group.descEn}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.tools.filter(tool => visible(tool.gates)).map((tool, ti) => (
                  <button
                    key={ti}
                    onClick={() => setLocation(tool.path)}
                    className={`text-left p-4 rounded-lg border transition-colors hover:bg-white dark:hover:bg-gray-800 ${
                      tool.highlighted
                        ? "border-secondary bg-secondary/10"
                        : "border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/30"
                    }`}
                    data-testid={`toolkit-tool-${tool.path.slice(1)}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {mode === "bm" ? tool.titleBm : tool.titleEn}
                      </h3>
                      {tool.highlighted && (
                        <Badge className="bg-secondary text-white shrink-0">{t("Start here", "Mula di sini")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      <span className="font-semibold">{t("When: ", "Bila: ")}</span>
                      {mode === "bm" ? tool.whenBm : tool.whenEn}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
