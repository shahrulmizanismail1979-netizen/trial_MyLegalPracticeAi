import { useGate, type Gate, GATE_INFO } from "@/lib/gate-context";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const colorClasses: Record<string, { border: string; bg: string; text: string; hoverBorder: string; iconBg: string }> = {
  emerald: {
    border: "border-emerald-700/40",
    bg: "bg-emerald-950/20",
    text: "text-emerald-400",
    hoverBorder: "hover:border-emerald-500/70",
    iconBg: "bg-emerald-900/40",
  },
  rose: {
    border: "border-rose-700/40",
    bg: "bg-rose-950/20",
    text: "text-rose-400",
    hoverBorder: "hover:border-rose-500/70",
    iconBg: "bg-rose-900/40",
  },
  amber: {
    border: "border-amber-700/40",
    bg: "bg-amber-950/20",
    text: "text-amber-400",
    hoverBorder: "hover:border-amber-500/70",
    iconBg: "bg-amber-900/40",
  },
};

export default function GateSelectPage() {
  const { setGate } = useGate();
  const { mode, ts } = useLanguage();
  const { user, logout } = useAuth();

  const gates: Gate[] = ["civil", "criminal", "advisory"];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-secondary/20 border border-secondary/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="font-serif font-bold text-base">MySyariahAI</h1>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-xs">
          {ts("Logout", "Log Keluar", "تسجيل خروج")}
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-5xl w-full">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-3">
              {ts("Select Your Practice Gate", "Pilih Gerbang Amalan Anda", "اختر بوابة الممارسة")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {ts(
                "Choose the area of Shariah legal practice. Content, AI assistants, and tools will be tailored to your selection.",
                "Pilih bidang amalan undang-undang Syariah. Kandungan, pembantu AI dan alatan akan disesuaikan dengan pilihan anda.",
                "اختر مجال ممارسة الشريعة. سيتم تخصيص المحتوى والأدوات وفقًا لاختيارك."
              )}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {gates.map((g) => {
              const info = GATE_INFO[g];
              const c = colorClasses[info.color];
              const title = mode === "bm" ? info.bm : mode === "ar" ? info.ar : info.en;
              const desc = mode === "bm" ? info.descBm : info.descEn;
              return (
                <button
                  key={g}
                  onClick={() => setGate(g)}
                  className={`text-left rounded-xl border-2 ${c.border} ${c.bg} ${c.hoverBorder} p-6 transition-all hover:scale-[1.02] hover:shadow-lg group`}
                >
                  <div className={`w-12 h-12 rounded-lg ${c.iconBg} flex items-center justify-center mb-4`}>
                    <svg className={`w-6 h-6 ${c.text}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={info.icon} />
                    </svg>
                  </div>
                  <h3 className={`font-serif font-bold text-lg mb-2 ${c.text}`}>{title}</h3>
                  {mode !== "ar" && (
                    <p className="text-xs text-muted-foreground/80 italic mb-3">
                      {mode === "bm" ? info.en : info.bm}
                    </p>
                  )}
                  <p className="text-sm text-foreground/80 leading-relaxed">{desc}</p>
                  <div className={`mt-4 text-xs ${c.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {ts("Enter →", "Masuk →", "← دخول")}
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            {ts(
              "You can switch gates anytime from the navigation menu.",
              "Anda boleh menukar gerbang pada bila-bila masa dari menu navigasi.",
              "يمكنك التبديل بين البوابات في أي وقت من قائمة التنقل."
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
