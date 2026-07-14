import { Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();

  return (
    <div
      className={`flex items-center gap-0.5 rounded-md bg-white/5 ring-1 ring-white/10 p-0.5 ${className}`}
      role="group"
      aria-label="Language"
    >
      <Globe className="w-3.5 h-3.5 mx-1 text-[hsl(var(--gold-bright))]" />
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
          lang === "en"
            ? "bg-[hsl(var(--gold-bright))]/20 text-[hsl(var(--gold-bright))]"
            : "text-[hsl(40_30%_82%)] hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("ms")}
        aria-pressed={lang === "ms"}
        className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
          lang === "ms"
            ? "bg-[hsl(var(--gold-bright))]/20 text-[hsl(var(--gold-bright))]"
            : "text-[hsl(40_30%_82%)] hover:text-white"
        }`}
      >
        BM
      </button>
    </div>
  );
}
