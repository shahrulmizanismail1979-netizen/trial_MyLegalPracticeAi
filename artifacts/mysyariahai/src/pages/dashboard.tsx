import type React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useUpcomingDeadlines, categoryMeta, daysUntil } from "@/hooks/use-matters";
import { CalendarClock, AlertTriangle, ArrowRight } from "lucide-react";
import { ParalegalWidget } from "@workspace/paralegal-widget";

const COLORS = ["hsl(164 40% 35%)", "hsl(43 60% 45%)", "hsl(150 50% 35%)", "hsl(200 40% 40%)", "hsl(330 40% 40%)", "hsl(164 50% 25%)"];

const paralegalRequest = (path: string, init?: RequestInit) =>
  fetch(`/api/sya${path}`, { ...init, credentials: "include" });

export default function DashboardPage() {
  const { t, mode } = useLanguage();
  const { user } = useAuth();
  const [guideExpanded, setGuideExpanded] = useState(false);
  const { data: stats, error: statsError } = useQuery({ queryKey: ["dashboard-stats"], queryFn: api.dashboard.stats });
  const { data: distribution, error: distError } = useQuery({ queryKey: ["case-distribution"], queryFn: api.dashboard.caseDistribution });
  const { data: upcoming } = useUpcomingDeadlines(30);
  const urgentDeadlines = (upcoming ?? []).slice(0, 5);

  const statCards = [
    { label: t("Legal Provisions", "Peruntukan"), value: stats?.totalProvisions || 0, icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { label: t("Case Laws", "Kes Undang-Undang"), value: stats?.totalCases || 0, icon: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" },
    { label: t("Cause Papers", "Kertas Kausa"), value: stats?.totalCausePapers || 0, icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { label: t("Procedures", "Tatacara"), value: stats?.totalWorkflows || 0, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { label: t("Glossary Terms", "Istilah Glosari"), value: stats?.totalGlossaryTerms || 0, icon: "M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" },
    { label: t("Legislation", "Perundangan"), value: stats?.totalLegislation || 0, icon: "M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" },
  ];

  const chartData = distribution?.map((d: any) => ({
    name: mode === "bm" ? d.categoryBm : d.category,
    count: d.count,
  })) || [];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Dashboard", "Papan Pemuka")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(`Welcome, ${user?.name}`, `Selamat datang, ${user?.name}`)}
        </p>
      </div>

      {(statsError || distError) && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3">
            <p className="text-sm text-destructive">
              {t("Failed to load dashboard data. Please refresh the page.", "Gagal memuatkan data papan pemuka. Sila muat semula halaman.")}
            </p>
          </CardContent>
        </Card>
      )}

      {urgentDeadlines.length > 0 && (
        <Card className="border-amber-800/30 bg-amber-950/10" data-testid="dashboard-deadlines">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  {t("Upcoming Syariah deadlines (30 days)", "Tarikh akhir Syariah akan datang (30 hari)")}
                </h2>
              </div>
              <Link href="/matters">
                <span className="inline-flex items-center gap-1 text-xs text-secondary hover:text-secondary/80 cursor-pointer font-medium">
                  {t("View all matters", "Lihat semua fail kes")} <ArrowRight className="h-3 w-3" />
                </span>
              </Link>
            </div>
            <div className="space-y-1.5">
              {urgentDeadlines.map((d) => {
                const days = daysUntil(d.dueDate);
                const cat = categoryMeta(d.category);
                return (
                  <Link key={d.id} href={`/matters/${d.matterId}`}>
                    <div className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:text-secondary transition-colors flex-wrap">
                      {days < 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-red-400">
                          <AlertTriangle className="h-3 w-3" /> {t(`${Math.abs(days)}d overdue`, `Lewat ${Math.abs(days)}h`)}
                        </span>
                      ) : (
                        <span className={`font-semibold ${days <= 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                          {days === 0 ? t("Today", "Hari ini") : t(`${days}d`, `${days}h`)}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                      <span className="text-foreground font-medium">{d.title}</span>
                      <span className="text-muted-foreground">— {d.matterTitle}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={stat.icon} />
                </svg>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/15 border border-secondary/25 flex items-center justify-center">
                <svg className="w-5 h-5 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-serif font-semibold text-foreground">
                  {t("How to Use MySyariahAI", "Cara Menggunakan MySyariahAI")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("Step-by-step guide to all platform features", "Panduan langkah demi langkah untuk semua ciri platform")}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGuideExpanded(!guideExpanded)}
              className="text-secondary hover:text-secondary/80"
            >
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${guideExpanded ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </Button>
          </div>
        </CardHeader>
        {guideExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-6">
              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t("Research & Reference", "Penyelidikan & Rujukan")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link href="/provisions">
                  <GuideCard
                    icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    title={t("Legal Provisions", "Peruntukan Undang-Undang")}
                    desc={t(
                      "Browse and search Shariah legal provisions by category. Click any provision to view its full text, section reference, and related cases.",
                      "Layari dan cari peruntukan undang-undang Syariah mengikut kategori. Klik mana-mana peruntukan untuk melihat teks penuh, rujukan seksyen, dan kes berkaitan."
                    )}
                    color="text-emerald-400"
                  />
                </Link>
                <Link href="/cases">
                  <GuideCard
                    icon="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                    title={t("Case Laws", "Kes Undang-Undang")}
                    desc={t(
                      "Search reported Shariah court cases. Each case shows Facts, Issues, Held (decision), and Significance tabs for structured analysis.",
                      "Cari kes mahkamah Syariah yang dilaporkan. Setiap kes memaparkan tab Fakta, Isu, Keputusan, dan Kepentingan untuk analisis berstruktur."
                    )}
                    color="text-amber-400"
                  />
                </Link>
                <Link href="/legislation">
                  <GuideCard
                    icon="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    title={t("Legislation", "Perundangan")}
                    desc={t(
                      "Reference Malaysian Islamic law statutes and enactments. Covers federal and state-level Shariah legislation.",
                      "Rujukan statut dan enakmen undang-undang Islam Malaysia. Meliputi perundangan Syariah peringkat persekutuan dan negeri."
                    )}
                    color="text-teal-400"
                  />
                </Link>
                <Link href="/quranic-verses">
                  <GuideCard
                    icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    title={t("Quranic Verses", "Ayat Al-Quran")}
                    desc={t(
                      "40 Quranic verses with Arabic text, English and Malay translations, and legal relevance. Filter by legal categories like Family, Property, or Criminal law.",
                      "40 ayat Al-Quran dengan teks Arab, terjemahan Inggeris dan Melayu, serta relevan undang-undang. Tapis mengikut kategori seperti Keluarga, Harta, atau Jenayah."
                    )}
                    color="text-emerald-300"
                  />
                </Link>
                <Link href="/fatwas">
                  <GuideCard
                    icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    title={t("Gazetted Fatwas", "Fatwa Bergazet")}
                    desc={t(
                      "15 Malaysian gazetted fatwa rulings with summary and detail views. Filter by category and see issuing authority, gazette reference, and full reasoning.",
                      "15 keputusan fatwa bergazet Malaysia dengan paparan ringkasan dan terperinci. Tapis mengikut kategori dan lihat pihak berkuasa, rujukan warta, dan penaakulan penuh."
                    )}
                    color="text-yellow-400"
                  />
                </Link>
                <Link href="/glossary">
                  <GuideCard
                    icon="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    title={t("Glossary", "Glosari")}
                    desc={t(
                      "Arabic, English, and Malay legal terms with definitions. Browse alphabetically or search for specific terms used in Shariah practice.",
                      "Istilah undang-undang Arab, Inggeris, dan Melayu dengan definisi. Layari mengikut abjad atau cari istilah khusus amalan Syariah."
                    )}
                    color="text-sky-400"
                  />
                </Link>
              </div>

              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t("Practice Tools", "Alat Amalan")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link href="/drafting">
                  <GuideCard
                    icon="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    title={t("Drafting", "Mendraf")}
                    desc={t(
                      "One place for all document drafting — cause papers (saman, afidavit, notis), general documents, and formal legal opinions. Pick the tool that matches what you need to produce.",
                      "Satu tempat untuk semua kerja mendraf — kertas kausa (saman, afidavit, notis), dokumen umum, dan pendapat undang-undang formal. Pilih alat yang sepadan dengan keperluan anda."
                    )}
                    color="text-violet-400"
                  />
                </Link>
                <Link href="/workflows">
                  <GuideCard
                    icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    title={t("Procedural Workflows", "Tatacara Prosedur")}
                    desc={t(
                      "Step-by-step court procedure guides with timelines and filing fees. Follow each stage from filing to hearing to judgment.",
                      "Panduan prosedur mahkamah langkah demi langkah dengan garis masa dan yuran pemfailan. Ikuti setiap peringkat dari pemfailan hingga perbicaraan hingga penghakiman."
                    )}
                    color="text-orange-400"
                  />
                </Link>
                <Link href="/kitab">
                  <GuideCard
                    icon="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    title={t("Classical Kitab Library", "Perpustakaan Kitab Klasik")}
                    desc={t(
                      "Browse 20 authoritative Islamic legal texts used in Malaysian courts. View author details, school of jurisprudence, key topics, and use AI to analyze any legal question through the classical kitab.",
                      "Layari 20 teks undang-undang Islam berautoriti yang digunakan di mahkamah Malaysia. Lihat maklumat pengarang, mazhab, topik utama, dan gunakan AI untuk menganalisis soalan undang-undang melalui kitab klasik."
                    )}
                    color="text-cyan-400"
                  />
                </Link>
                <Link href="/court-tools">
                  <GuideCard
                    icon="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    title={t("Court Fee & Timeline Calculator", "Kalkulator Yuran & Garis Masa")}
                    desc={t(
                      "Estimate Shariah court filing fees for family, inheritance, enforcement, and criminal matters. View limitation periods with statutory basis, and step-by-step procedural timelines for divorce and nafkah cases.",
                      "Anggarkan yuran pemfailan mahkamah Syariah untuk kes keluarga, pewarisan, penguatkuasaan, dan jenayah. Lihat tempoh had dengan asas statut, dan garis masa prosedur langkah demi langkah untuk kes perceraian dan nafkah."
                    )}
                    color="text-lime-400"
                  />
                </Link>
              </div>

              <div className="flex items-center gap-2 pb-2 border-b border-border/40">
                <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {t("AI-Powered Analysis", "Analisis Berkuasa AI")}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <Link href="/case-workspace">
                  <GuideCard
                    icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    title={t("Case Workspace (start here)", "Ruang Kerja Kes (mula di sini)")}
                    desc={t(
                      "Enter your case facts once and AI runs the three core analyses together — cross-references, case strength & prediction, and a draft legal opinion. Replaces running the separate analyser tools one by one.",
                      "Masukkan fakta kes anda sekali dan AI menjalankan tiga analisis teras serentak — rujukan silang, kekuatan & ramalan kes, dan draf pendapat undang-undang. Menggantikan penggunaan alat analisis berasingan satu demi satu."
                    )}
                    color="text-yellow-300"
                    highlight
                  />
                </Link>
                <Link href="/ai-counsel">
                  <GuideCard
                    icon="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    title={t("AI Senior Shariah Counsel", "Peguam Kanan Syariah AI")}
                    desc={t(
                      "Chat with an AI Senior Shariah Counsel powered by Gemini 2.5 Flash. Ask complex legal questions, get streaming responses with citations and analysis.",
                      "Berbual dengan Peguam Kanan Syariah AI berkuasa Gemini 2.5 Flash. Tanya soalan undang-undang kompleks, dapatkan jawapan secara strim dengan petikan dan analisis."
                    )}
                    color="text-rose-400"
                    highlight
                  />
                </Link>
                <Link href="/compliance-check">
                  <GuideCard
                    icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    title={t("AI Shariah Compliance Checker", "Penyemak Pematuhan Syariah AI")}
                    desc={t(
                      "Evaluate any transaction against Shariah principles across 13 types including Murabahah, Musharakah, Takaful, and Sukuk. Get a structured compliance verdict with risk assessment and SAC ruling references.",
                      "Nilai mana-mana transaksi terhadap prinsip Syariah merentasi 13 jenis termasuk Murabahah, Musharakah, Takaful, dan Sukuk. Dapatkan keputusan pematuhan berstruktur dengan penilaian risiko dan rujukan keputusan MPS."
                    )}
                    color="text-green-400"
                    highlight
                  />
                </Link>
                <Link href="/client-intake">
                  <GuideCard
                    icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                    title={t("AI Client Intake Assistant", "Pembantu Pengambilan Klien AI")}
                    desc={t(
                      "Smart intake forms for Nafkah, Fasakh, and Hadhanah cases. Fill in client details and the AI generates a comprehensive case brief with legal analysis, strategy, evidence checklist, and estimated timelines.",
                      "Borang pengambilan pintar untuk kes Nafkah, Fasakh, dan Hadhanah. Isi butiran klien dan AI menjana taklimat kes komprehensif dengan analisis undang-undang, strategi, senarai semak bukti, dan anggaran garis masa."
                    )}
                    color="text-pink-400"
                    highlight
                  />
                </Link>
              </div>

              <Card className="border-secondary/20 bg-secondary/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                      <p className="font-medium text-foreground">
                        {t("Tips for Best Results", "Petua untuk Hasil Terbaik")}
                      </p>
                      <ul className="space-y-1.5 list-disc list-inside">
                        <li>{t(
                          "Use the search bar on any page to quickly find specific provisions, cases, or terms.",
                          "Gunakan bar carian di mana-mana halaman untuk mencari peruntukan, kes, atau istilah tertentu dengan cepat."
                        )}</li>
                        <li>{t(
                          "From any detail page, click \"Cross-Reference with AI\" to run an AI analysis using that item as context.",
                          "Dari mana-mana halaman terperinci, klik \"Rujuk Silang dengan AI\" untuk menjalankan analisis AI menggunakan item tersebut sebagai konteks."
                        )}</li>
                        <li>{t(
                          "Switch between English and Bahasa Melayu using the language selector in the sidebar.",
                          "Tukar antara Bahasa Inggeris dan Bahasa Melayu menggunakan pemilih bahasa di bar sisi."
                        )}</li>
                        <li>{t(
                          "AI Analyzer results have \"View\" buttons that link directly to the referenced provision, case, verse, or fatwa.",
                          "Keputusan Penganalisis AI mempunyai butang \"Lihat\" yang berpaut terus kepada peruntukan, kes, ayat, atau fatwa yang dirujuk."
                        )}</li>
                        <li>{t(
                          "In the Legal Opinion Writer, select the area of law first for more targeted analysis. Be specific with your facts for better results.",
                          "Dalam Penulis Pendapat Undang-Undang, pilih bidang undang-undang terlebih dahulu untuk analisis lebih tepat. Nyatakan fakta secara spesifik untuk hasil yang lebih baik."
                        )}</li>
                        <li>{t(
                          "The Compliance Checker works best when you describe the full transaction structure, including parties, amounts, and contract terms.",
                          "Penyemak Pematuhan berfungsi paling baik apabila anda menerangkan struktur transaksi penuh, termasuk pihak-pihak, jumlah, dan terma kontrak."
                        )}</li>
                        <li>{t(
                          "Court Tools fees are estimates for Federal Territory. Always verify with the specific court registry before advising clients.",
                          "Yuran Alat Mahkamah adalah anggaran untuk Wilayah Persekutuan. Sentiasa sahkan dengan pendaftaran mahkamah sebelum menasihati klien."
                        )}</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h2 className="text-lg font-serif font-semibold text-foreground">
            {t("Case Distribution by Category", "Taburan Kes Mengikut Kategori")}
          </h2>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(160 15% 65%)" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 11, fill: "hsl(160 15% 65%)" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(164 40% 8%)",
                    border: "1px solid hsl(164 30% 15%)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "hsl(160 20% 90%)",
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
                  {chartData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-muted/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground mb-1">
                {t("Quick Reference", "Rujukan Pantas")}
              </p>
              <p>
                {t(
                  "Islamic law in Malaysia is a STATE matter under Schedule 9, List II of the Federal Constitution. The Federal Territory follows the Islamic Family Law (Federal Territories) Act 1984 (Act 303). Each state has its own enactments.",
                  "Undang-undang Islam di Malaysia adalah perkara NEGERI di bawah Jadual 9, Senarai II Perlembagaan Persekutuan. Wilayah Persekutuan mengikuti Akta Undang-Undang Keluarga Islam (Wilayah-Wilayah Persekutuan) 1984 (Akta 303). Setiap negeri mempunyai enakmen sendiri."
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ParalegalWidget portalName="MySyariahAI" request={paralegalRequest} accent="#8a6d2f" />
    </div>
  );
}

function GuideCard({ icon, title, desc, color, highlight }: {
  icon: string;
  title: React.ReactNode;
  desc: React.ReactNode;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`group p-4 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-md ${
      highlight
        ? "border-secondary/30 bg-secondary/5 hover:border-secondary/50 hover:bg-secondary/10"
        : "border-border/40 bg-card/50 hover:border-border hover:bg-card"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${
          highlight ? "bg-secondary/15 border border-secondary/25" : "bg-muted/50 border border-border/50"
        }`}>
          <svg className={`w-4.5 h-4.5 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d={icon} />
          </svg>
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground group-hover:text-secondary transition-colors flex items-center gap-1.5">
            {title}
            <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}
