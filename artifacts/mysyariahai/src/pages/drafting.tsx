import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { SyariahToolGuidance } from "@/components/SyariahToolGuidance";

type Gate = "civil" | "criminal" | "advisory";

interface Tool {
  path: string;
  titleEn: string;
  titleBm: string;
  whenEn: string;
  whenBm: string;
  gates: Gate[] | "all";
}

const TOOLS: Tool[] = [
  {
    path: "/cause-papers",
    titleEn: "Cause Papers AI Drafter",
    titleBm: "Pendraf AI Kertas Kausa",
    whenEn: "You have a specific cause-paper template (saman, afidavit, notis) and want it filled and expanded with your case details.",
    whenBm: "Anda ada templat kertas kausa tertentu (saman, afidavit, notis) dan mahu ia diisi serta diperkembang dengan butiran kes anda.",
    gates: ["civil", "criminal"],
  },
  {
    path: "/document-generator",
    titleEn: "General Document Generator",
    titleBm: "Penjana Dokumen Umum",
    whenEn: "You need a document that isn't covered by the cause-paper templates — letters, applications, or generic pleadings.",
    whenBm: "Anda memerlukan dokumen yang tidak diliputi oleh templat kertas kausa — surat, permohonan, atau pleading umum.",
    gates: ["civil", "criminal", "advisory"],
  },
  {
    path: "/legal-opinion",
    titleEn: "Legal Opinion Writer",
    titleBm: "Penulis Pendapat Undang-Undang",
    whenEn: "Draft a formal Pendapat Undang-Undang (Issues / Applicable Law / Analysis / Conclusion) for a client.",
    whenBm: "Drafkan Pendapat Undang-Undang formal (Isu / Undang-undang Berkaitan / Analisis / Kesimpulan) untuk klien.",
    gates: ["advisory"],
  },
];

export default function DraftingPage() {
  const { mode } = useLanguage();
  const { gate } = useGate();
  const [, setLocation] = useLocation();
  const t = (en: string, bm: string) => (mode === "bm" ? bm : en);

  const visible = (g: Tool["gates"]) => {
    if (g === "all") return true;
    if (!gate) return true;
    return (g as Gate[]).includes(gate as Gate);
  };

  const tools = TOOLS.filter((tool) => visible(tool.gates));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="drafting-title">
          {t("Drafting", "Mendraf")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-3xl">
          {t(
            "Every document drafting tool in one place. Pick the one that matches what you need to produce — court papers, a general document, or a formal legal opinion.",
            "Semua alat mendraf dokumen di satu tempat. Pilih yang sepadan dengan keperluan anda — kertas mahkamah, dokumen umum, atau pendapat undang-undang formal.",
          )}
        </p>
      </div>
      <div className="mb-8"><SyariahToolGuidance kind="drafting" /></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map((tool) => (
          <button
            key={tool.path}
            onClick={() => setLocation(tool.path)}
            className="text-left p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/30 transition-colors hover:bg-white dark:hover:bg-gray-800 hover:border-secondary"
            data-testid={`drafting-tool-${tool.path.slice(1)}`}
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              {mode === "bm" ? tool.titleBm : tool.titleEn}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              <span className="font-semibold">{t("When: ", "Bila: ")}</span>
              {mode === "bm" ? tool.whenBm : tool.whenEn}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
