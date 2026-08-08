import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useLanguage, type LanguageMode } from "@/lib/language-context";
import { useGate, GATE_INFO } from "@/lib/gate-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Gate = "civil" | "criminal" | "advisory" | "all";

const navItems: Array<{ path: string; label: string; labelBm: string; labelAr: string; icon: string; gates: Gate[]; adminOnly?: boolean }> = [
  { path: "/", label: "Dashboard", labelBm: "Papan Pemuka", labelAr: "لوحة المعلومات", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6", gates: ["all"] },
  { path: "/provisions", label: "Legal Provisions", labelBm: "Peruntukan Undang-Undang", labelAr: "الأحكام القانونية", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", gates: ["civil", "criminal", "advisory"] },
  { path: "/cases", label: "Case Laws", labelBm: "Kes Undang-Undang", labelAr: "السوابق القضائية", icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z", gates: ["civil", "criminal", "advisory"] },
  { path: "/drafting", label: "Drafting", labelBm: "Mendraf", labelAr: "الصياغة", icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z", gates: ["civil", "criminal", "advisory"] },
  { path: "/matters", label: "Matter Files", labelBm: "Fail Kes", labelAr: "ملفات القضايا", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", gates: ["civil", "criminal", "advisory"] },
  { path: "/workflows", label: "Procedures", labelBm: "Tatacara", labelAr: "الإجراءات", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01", gates: ["civil", "criminal"] },
  { path: "/court-tools", label: "Court Tools", labelBm: "Alat Mahkamah", labelAr: "أدوات المحكمة", icon: "M9 7h6m0 4H9m12-5.5V19a2 2 0 01-2 2H5a2 2 0 01-2-2V5.5L5.5 3h13L21 5.5z", gates: ["civil", "criminal"] },
  { path: "/client-intake", label: "Client Intake", labelBm: "Pengambilan Klien", labelAr: "استقبال العميل", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", gates: ["civil", "criminal", "advisory"] },
  { path: "/compliance-check", label: "Compliance Check", labelBm: "Semakan Pematuhan", labelAr: "فحص الامتثال", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z", gates: ["advisory"] },
  { path: "/legislation", label: "Legislation", labelBm: "Perundangan", labelAr: "التشريعات", icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3", gates: ["civil", "criminal", "advisory"] },
  { path: "/quranic-verses", label: "Quranic Verses", labelBm: "Ayat Al-Quran", labelAr: "الآيات القرآنية", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", gates: ["civil", "criminal", "advisory"] },
  { path: "/tafsir", label: "AI Tafsir", labelBm: "Tafsir AI", labelAr: "تفسير بالذكاء", icon: "M4 6h16M4 12h16M4 18h7", gates: ["civil", "criminal", "advisory"] },
  { path: "/voice-mode", label: "Voice Mode", labelBm: "Mod Suara", labelAr: "الوضع الصوتي", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z", gates: ["civil", "criminal"] },
  { path: "/fatwas", label: "Gazetted Fatwas", labelBm: "Fatwa Bergazet", labelAr: "الفتاوى المعتمدة", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", gates: ["civil", "criminal", "advisory"] },
  { path: "/practice-directions", label: "Practice Directions", labelBm: "Arahan Amalan", labelAr: "التوجيهات العملية", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", gates: ["civil", "criminal", "advisory"] },
  { path: "/kitab", label: "Kitab Reference", labelBm: "Rujukan Kitab", labelAr: "مرجع الكتب", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", gates: ["civil", "criminal", "advisory"] },
  { path: "/glossary", label: "Glossary", labelBm: "Glosari", labelAr: "المصطلحات", icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129", gates: ["civil", "criminal", "advisory"] },
  { path: "/faraid-calculator", label: "Faraid Calculator", labelBm: "Kalkulator Faraid", labelAr: "حاسبة الفرائض", icon: "M9 7h6m-6 4h6m-3 4v3m-4-3h8l-4 3m-8-12a9 9 0 1118 0 9 9 0 01-18 0z", gates: ["civil", "advisory"] },
  { path: "/ai-toolkit", label: "AI Toolkit", labelBm: "Kit Alat AI", labelAr: "أدوات الذكاء", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", gates: ["civil", "criminal", "advisory"] },
  { path: "/case-workspace", label: "Case Workspace", labelBm: "Ruang Kerja Kes", labelAr: "مساحة عمل القضية", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", gates: ["civil", "criminal", "advisory"] },
  { path: "/smart-search", label: "Smart Search", labelBm: "Carian Pintar", labelAr: "البحث الذكي", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", gates: ["civil", "criminal", "advisory"] },
  { path: "/ai-counsel", label: "AI Counsel", labelBm: "Peguam AI", labelAr: "المستشار الذكي", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", gates: ["civil", "criminal", "advisory"] },
  { path: "/admin", label: "Admin", labelBm: "Pentadbir", labelAr: "إدارة", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z", gates: ["all"], adminOnly: true },
];

type SectionKey =
  | "main"
  | "research"
  | "analyse"
  | "draft"
  | "practice"
  | "admin";

const SECTION_OF: Record<string, SectionKey> = {
  "/": "main",
  // Research the sources
  "/smart-search": "research",
  "/ai-counsel": "research",
  "/provisions": "research",
  "/cases": "research",
  "/legislation": "research",
  "/fatwas": "research",
  "/practice-directions": "research",
  "/quranic-verses": "research",
  "/tafsir": "research",
  "/kitab": "research",
  "/glossary": "research",
  // Analyse the case
  "/case-workspace": "analyse",
  "/ai-toolkit": "analyse",
  "/compliance-check": "analyse",
  "/client-intake": "analyse",
  // Draft & file
  "/drafting": "draft",
  "/matters": "draft",
  // Practice & tools
  "/voice-mode": "practice",
  "/court-tools": "practice",
  "/workflows": "practice",
  "/faraid-calculator": "practice",
  // Admin
  "/admin": "admin",
};

const SECTIONS: Array<{ key: SectionKey; en: string; bm: string; ar: string }> =
  [
    { key: "main", en: "", bm: "", ar: "" },
    { key: "research", en: "Research", bm: "Penyelidikan", ar: "البحث" },
    { key: "analyse", en: "Analyse", bm: "Analisis", ar: "التحليل" },
    { key: "draft", en: "Draft & File", bm: "Draf & Fail", ar: "الصياغة" },
    {
      key: "practice",
      en: "Practice & Tools",
      bm: "Amalan & Alat",
      ar: "الممارسة",
    },
    { key: "admin", en: "Admin", bm: "Pentadbir", ar: "إدارة" },
  ];

function NavIcon({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className || "w-5 h-5"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const gateAccent: Record<string, { dot: string; text: string; border: string }> = {
  emerald: { dot: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-700/40" },
  rose: { dot: "bg-rose-500", text: "text-rose-400", border: "border-rose-700/40" },
  amber: { dot: "bg-amber-500", text: "text-amber-400", border: "border-amber-700/40" },
};

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { mode, setMode, ts } = useLanguage();
  const { gate, setGate } = useGate();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const gateInfo = gate ? GATE_INFO[gate] : null;
  const accent = gateInfo ? gateAccent[gateInfo.color] : { dot: "bg-secondary", text: "text-secondary", border: "border-secondary/30" };

  const visibleNav = navItems.filter((item) => {
    if (item.adminOnly && user?.role !== "admin") return false;
    if (item.gates.includes("all")) return true;
    if (gate && item.gates.includes(gate)) return true;
    return false;
  });

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary/20 border border-secondary/30 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="font-serif font-bold text-sm text-sidebar-foreground">MySyariahAI</h1>
              <p className="text-xs text-sidebar-foreground/60">{ts("Shariah Legal Platform", "Platform Undang-Undang Syariah", "منصة قانونية شرعية")}</p>
            </div>
          </div>
        </div>

        {gateInfo && (
          <div className={`mx-3 mt-3 mb-1 p-2.5 rounded-md border ${accent.border} bg-sidebar-accent/30`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
              <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">{ts("Active Gate", "Gerbang Aktif", "البوابة النشطة")}</span>
            </div>
            <p className={`text-xs font-medium ${accent.text} leading-tight`}>
              {mode === "bm" ? gateInfo.bm : mode === "ar" ? gateInfo.ar : gateInfo.en}
            </p>
            <button
              onClick={() => setGate(null)}
              className="mt-1.5 text-[10px] text-sidebar-foreground/60 hover:text-sidebar-foreground underline-offset-2 hover:underline"
            >
              {ts("Switch gate", "Tukar gerbang", "تبديل البوابة")}
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {SECTIONS.map((section) => {
            const items = visibleNav.filter(
              (it) => (SECTION_OF[it.path] ?? "research") === section.key,
            );
            if (items.length === 0) return null;
            const header =
              mode === "bm" ? section.bm : mode === "ar" ? section.ar : section.en;
            return (
              <div key={section.key} className="space-y-1">
                {header && (
                  <p
                    className={`px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 ${
                      mode === "ar" ? "text-right" : ""
                    }`}
                    dir={mode === "ar" ? "rtl" : undefined}
                  >
                    {header}
                  </p>
                )}
                {items.map((item) => {
                  const isActive =
                    location === item.path ||
                    (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <Link key={item.path} href={item.path}>
                      <div
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`}
                      >
                        <NavIcon d={item.icon} className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? accent.text : ""}`} />
                        <span className="truncate">
                          {mode === "bm" ? item.labelBm : mode === "en" ? item.label : mode === "ar" ? (
                            <span dir="rtl">{item.labelAr}</span>
                          ) : (
                            <span className="flex flex-col leading-tight">
                              <span className="text-xs">{item.label}</span>
                              <span className="text-xs text-sidebar-foreground/50">{item.labelBm}</span>
                            </span>
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-2 px-2">
            <span className="text-xs text-sidebar-foreground/50 flex-shrink-0">Lang:</span>
            <Select value={mode} onValueChange={(v) => setMode(v as LanguageMode)}>
              <SelectTrigger className="h-7 text-xs bg-sidebar-accent border-sidebar-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">EN / BM</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="bm">B. Melayu</SelectItem>
                <SelectItem value="ar">العربية (Arabic)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {user && (
            <>
              <Link href="/account">
                <div
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-sidebar-accent/50 cursor-pointer"
                >
                  <span className="text-xs text-sidebar-foreground/70">
                    {ts("Account & Plan", "Akaun & Pelan", "الحساب والخطة")}
                  </span>
                  <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-secondary/20 text-secondary capitalize">
                    {user.tier}
                  </span>
                </div>
              </Link>
              <div className="flex items-center justify-between px-2">
                <div className="text-xs">
                  <p className="text-sidebar-foreground/80 truncate">{user.name}</p>
                  <p className="text-sidebar-foreground/40 capitalize">{user.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground h-7 px-2"
                >
                  {ts("Logout", "Keluar", "خروج")}
                </Button>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border h-12 flex items-center px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted text-foreground"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-serif font-semibold text-sm">MySyariahAI</span>
          {gateInfo && (
            <span className={`ml-auto text-xs ${accent.text} flex items-center gap-1.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
              {mode === "bm" ? gateInfo.shortBm : mode === "ar" ? gateInfo.ar : gateInfo.shortEn}
            </span>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>

        <footer className="border-t border-border bg-muted/30 px-4 py-2">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            Semua rujukan kes dan perundangan mesti disahkan secara bebas terhadap sumber primer /
            All case and legislative references must be independently verified against primary sources
          </p>
        </footer>
      </div>
    </div>
  );
}
