import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Check,
  Crown,
  Sparkles,
  Loader2,
  ShieldCheck,
  Mail,
  Copy,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type PlanKey = "monthly" | "quarterly" | "yearly" | "lifetime";

interface ApiPlan {
  price_id: string;
  unit_amount: number | null;
  currency: string | null;
  recurring: { interval?: string; interval_count?: number } | null;
  price_metadata: { plan?: string } | null;
}

interface Purchase {
  code?: string;
  email?: string;
  plan?: string;
  emailSent?: boolean;
  pending?: boolean;
}

const COPY = {
  en: {
    eyebrow: "Practitioner Access",
    title: "One platform. Full access. Your billing, your way.",
    subtitle:
      "Every plan unlocks the complete MyLitAi suite — AI Chambers, Drafting Studio, Document Analyzer, and the full legal Library. Choose the billing duration that suits your practice.",
    perMonth: "/ month",
    perQuarter: "/ 3 months",
    perYear: "/ year",
    oneTime: "one-time",
    monthlyEquiv: (v: string) => `≈ ${v} / month`,
    popular: "Most popular",
    bestValue: "Best value",
    save: (p: string) => `Save ${p}`,
    choose: "Get started",
    chooseLifetime: "Buy lifetime",
    starting: "Redirecting to secure checkout…",
    features: [
      "AI Chambers — full IRAC reasoning pipeline",
      "Drafting Studio — pleadings, affidavits & letters",
      "Document Analyzer — upload & extract key facts",
      "Complete legal Library & costs calculators",
      "Bilingual (English / Bahasa Melayu)",
      "Continuous updates to law & precedents",
    ],
    plans: {
      monthly: { name: "Monthly", note: "Billed every month. Cancel anytime." },
      quarterly: { name: "Quarterly", note: "Billed every 3 months." },
      yearly: { name: "Yearly", note: "Billed once a year." },
      lifetime: { name: "Lifetime", note: "Pay once. Yours forever." },
    },
    loadError: "We couldn't load the plans right now. Please refresh and try again.",
    checkoutError: "We couldn't start checkout. Please try again.",
    // Success state
    successTitle: "Payment received — welcome aboard!",
    successBody:
      "Your personal access code is ready. We've also emailed a copy to you. Keep it confidential — it's the key to your account.",
    yourCode: "Your access code",
    emailedTo: (e: string) => `A copy has been emailed to ${e}.`,
    emailPending:
      "If you don't see the email shortly, check your spam folder or contact us.",
    howToLogin: "How to log in",
    loginSteps: [
      "Go to the MyLitAi platform login.",
      "Enter your access code exactly as shown above.",
      "Click Enter Platform to unlock full access.",
    ],
    copy: "Copy code",
    copied: "Copied",
    pendingTitle: "Finalising your purchase…",
    pendingBody:
      "Your payment is being confirmed. Your access code will arrive by email within a few minutes. You can safely close this page.",
    backToPlans: "Back to plans",
  },
  ms: {
    eyebrow: "Akses Pengamal",
    title: "Satu platform. Akses penuh. Bil mengikut cara anda.",
    subtitle:
      "Setiap pelan membuka keseluruhan suite MyLitAi — AI Chambers, Studio Drafan, Penganalisis Dokumen, dan Perpustakaan undang-undang penuh. Pilih tempoh bil yang sesuai dengan amalan anda.",
    perMonth: "/ bulan",
    perQuarter: "/ 3 bulan",
    perYear: "/ tahun",
    oneTime: "bayaran sekali",
    monthlyEquiv: (v: string) => `≈ ${v} / bulan`,
    popular: "Paling popular",
    bestValue: "Nilai terbaik",
    save: (p: string) => `Jimat ${p}`,
    choose: "Mula sekarang",
    chooseLifetime: "Beli seumur hidup",
    starting: "Mengalihkan ke pembayaran selamat…",
    features: [
      "AI Chambers — saluran penaakulan IRAC penuh",
      "Studio Drafan — pliding, afidavit & surat",
      "Penganalisis Dokumen — muat naik & ekstrak fakta",
      "Perpustakaan undang-undang & kalkulator kos penuh",
      "Dwibahasa (English / Bahasa Melayu)",
      "Kemas kini berterusan undang-undang & duluan",
    ],
    plans: {
      monthly: { name: "Bulanan", note: "Dibilkan setiap bulan. Batal bila-bila masa." },
      quarterly: { name: "Suku Tahunan", note: "Dibilkan setiap 3 bulan." },
      yearly: { name: "Tahunan", note: "Dibilkan sekali setahun." },
      lifetime: { name: "Seumur Hidup", note: "Bayar sekali. Milik anda selamanya." },
    },
    loadError: "Kami tidak dapat memuatkan pelan sekarang. Sila muat semula dan cuba lagi.",
    checkoutError: "Kami tidak dapat memulakan pembayaran. Sila cuba lagi.",
    successTitle: "Pembayaran diterima — selamat datang!",
    successBody:
      "Kod akses peribadi anda telah sedia. Kami juga telah menghantar salinan melalui e-mel. Sila rahsiakan — ia adalah kunci ke akaun anda.",
    yourCode: "Kod akses anda",
    emailedTo: (e: string) => `Salinan telah dihantar ke ${e}.`,
    emailPending:
      "Jika e-mel tidak diterima sebentar lagi, semak folder spam atau hubungi kami.",
    howToLogin: "Cara log masuk",
    loginSteps: [
      "Pergi ke log masuk platform MyLitAi.",
      "Masukkan kod akses anda tepat seperti di atas.",
      "Klik Masuk Platform untuk membuka akses penuh.",
    ],
    copy: "Salin kod",
    copied: "Disalin",
    pendingTitle: "Memuktamadkan pembelian anda…",
    pendingBody:
      "Pembayaran anda sedang disahkan. Kod akses akan tiba melalui e-mel dalam beberapa minit. Anda boleh menutup halaman ini.",
    backToPlans: "Kembali ke pelan",
  },
} as const;

const TIER_ORDER: PlanKey[] = ["monthly", "quarterly", "yearly", "lifetime"];

function inferPlanKey(p: ApiPlan): PlanKey {
  const tag = p.price_metadata?.plan as PlanKey | undefined;
  if (tag && TIER_ORDER.includes(tag)) return tag;
  if (!p.recurring) return "lifetime";
  if (p.recurring.interval === "year") return "yearly";
  if (p.recurring.interval === "month" && (p.recurring.interval_count ?? 1) === 3)
    return "quarterly";
  return "monthly";
}

function formatRM(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return `RM${v.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

export default function Pricing() {
  const { lang } = useLanguage();
  const c = COPY[lang];

  const [plans, setPlans] = useState<Record<PlanKey, ApiPlan> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);

  const pricingUrl = useMemo(
    () => `${window.location.origin}${import.meta.env.BASE_URL}pricing`,
    [],
  );

  // Handle the post-checkout return.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") !== "success") return;
    const sid = params.get("session_id");
    window.history.replaceState({}, "", `${import.meta.env.BASE_URL}pricing`);
    if (!sid) {
      setPurchase({ pending: true });
      return;
    }
    setConfirming(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/lit/billing/provision?session_id=${encodeURIComponent(sid)}`,
          { credentials: "include" },
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.code) setPurchase(json as Purchase);
        else setPurchase({ pending: true });
      } catch {
        setPurchase({ pending: true });
      } finally {
        setConfirming(false);
      }
    })();
  }, []);

  // Load plans.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/lit/billing/plans", { credentials: "include" });
        const json = (await res.json()) as { plans?: ApiPlan[] };
        const map = {} as Record<PlanKey, ApiPlan>;
        for (const p of json.plans ?? []) map[inferPlanKey(p)] = p;
        if (Object.keys(map).length === 0) setLoadError(true);
        else setPlans(map);
      } catch {
        setLoadError(true);
      }
    })();
  }, []);

  async function startCheckout(tier: PlanKey) {
    const plan = plans?.[tier];
    if (!plan) return;
    setBusy(tier);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/lit/billing/checkout-public", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan.price_id,
          successUrl: `${pricingUrl}?status=success`,
          cancelUrl: `${pricingUrl}?status=cancelled`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.url) {
        window.location.href = json.url as string;
        return;
      }
      setCheckoutError(c.checkoutError);
      setBusy(null);
    } catch {
      setCheckoutError(c.checkoutError);
      setBusy(null);
    }
  }

  function copyCode() {
    if (!purchase?.code) return;
    navigator.clipboard?.writeText(purchase.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Success / confirmation view ────────────────────────────────────────────
  if (confirming || purchase) {
    return (
      <div className="flex-1 px-6 py-16">
        <div className="max-w-xl mx-auto">
          {confirming ? (
            <div className="surface-oxford rounded-2xl p-10 text-center ring-1 ring-[hsl(var(--gold))]/20">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-[hsl(var(--gold-bright))]" />
              <p className="mt-4 text-[hsl(40_30%_82%)] font-serif">{c.pendingTitle}</p>
            </div>
          ) : purchase?.code ? (
            <div className="surface-oxford rounded-2xl p-8 sm:p-10 ring-1 ring-[hsl(var(--gold))]/30 gold-glow">
              <div className="flex justify-center">
                <span className="flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--gold))]/15 ring-1 ring-[hsl(var(--gold))]/40">
                  <CheckCircle2 className="w-7 h-7 text-[hsl(var(--gold-bright))]" />
                </span>
              </div>
              <h1 className="mt-5 text-center font-serif text-2xl font-bold text-[hsl(40_40%_95%)]">
                {c.successTitle}
              </h1>
              <p className="mt-3 text-center text-sm text-[hsl(40_25%_75%)] leading-relaxed">
                {c.successBody}
              </p>

              <div className="mt-7">
                <p className="text-xs uppercase tracking-widest text-[hsl(var(--gold-bright))] text-center mb-2">
                  {c.yourCode}
                </p>
                <div className="flex items-center justify-center gap-3 bg-[hsl(var(--oxford-deep))] rounded-xl px-5 py-4 ring-1 ring-[hsl(var(--gold))]/40">
                  <span className="font-mono text-2xl font-bold tracking-[0.25em] text-[hsl(var(--gold-bright))]">
                    {purchase.code}
                  </span>
                  <button
                    onClick={copyCode}
                    className="text-[hsl(40_30%_70%)] hover:text-white transition-colors"
                    title={c.copy}
                  >
                    {copied ? (
                      <CheckCircle2 className="w-5 h-5 text-[hsl(var(--gold-bright))]" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-3 flex items-center justify-center gap-2 text-xs text-[hsl(40_25%_70%)]">
                  <Mail className="w-3.5 h-3.5" />
                  {purchase.email ? c.emailedTo(purchase.email) : c.emailPending}
                </p>
              </div>

              <div className="mt-7 rounded-xl bg-[hsl(var(--oxford-deep))]/60 p-5 ring-1 ring-white/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--gold-bright))] mb-3">
                  {c.howToLogin}
                </p>
                <ol className="space-y-2 text-sm text-[hsl(40_25%_78%)] list-decimal list-inside">
                  {c.loginSteps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <div className="surface-oxford rounded-2xl p-8 sm:p-10 text-center ring-1 ring-[hsl(var(--gold))]/20">
              <span className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-[hsl(var(--gold))]/10 ring-1 ring-[hsl(var(--gold))]/30">
                <Mail className="w-7 h-7 text-[hsl(var(--gold-bright))]" />
              </span>
              <h1 className="mt-5 font-serif text-2xl font-bold text-[hsl(40_40%_95%)]">
                {c.pendingTitle}
              </h1>
              <p className="mt-3 text-sm text-[hsl(40_25%_75%)] leading-relaxed">
                {c.pendingBody}
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => setPurchase(null)}
              >
                {c.backToPlans}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Pricing grid ───────────────────────────────────────────────────────────
  return (
    <div className="flex-1 px-6 py-14">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--gold-bright))]">
            <Sparkles className="w-3.5 h-3.5" />
            {c.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-bold text-[hsl(40_40%_95%)] leading-tight">
            {c.title}
          </h1>
          <p className="mt-4 text-[hsl(40_25%_75%)] leading-relaxed">{c.subtitle}</p>
        </div>

        {checkoutError && (
          <div className="mt-8 max-w-md mx-auto flex items-center gap-2 rounded-lg bg-red-950/40 ring-1 ring-red-500/30 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {checkoutError}
          </div>
        )}

        {loadError ? (
          <div className="mt-12 text-center text-[hsl(40_25%_70%)]">{c.loadError}</div>
        ) : !plans ? (
          <div className="mt-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-[hsl(var(--gold-bright))]" />
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {TIER_ORDER.map((tier) => {
              const plan = plans[tier];
              if (!plan) return null;
              const meta = c.plans[tier];
              const highlight = tier === "yearly";
              const isLifetime = tier === "lifetime";

              const period =
                tier === "monthly"
                  ? c.perMonth
                  : tier === "quarterly"
                    ? c.perQuarter
                    : tier === "yearly"
                      ? c.perYear
                      : c.oneTime;

              const amount = plan.unit_amount ?? 0;
              const equiv =
                tier === "quarterly"
                  ? c.monthlyEquiv(formatRM(Math.round(amount / 3)))
                  : tier === "yearly"
                    ? c.monthlyEquiv(formatRM(Math.round(amount / 12)))
                    : null;

              const badge =
                tier === "yearly"
                  ? c.popular
                  : tier === "lifetime"
                    ? c.bestValue
                    : tier === "quarterly"
                      ? c.save("10%")
                      : null;

              return (
                <div
                  key={tier}
                  className={`relative flex flex-col rounded-2xl p-6 transition-transform hover:-translate-y-1 ${
                    highlight
                      ? "surface-oxford ring-2 ring-[hsl(var(--gold))]/60 gold-glow"
                      : "surface-oxford ring-1 ring-white/10"
                  }`}
                >
                  {badge && (
                    <span
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ${
                        highlight || isLifetime
                          ? "bg-[hsl(var(--gold-bright))] text-[hsl(var(--oxford-deep))]"
                          : "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold-bright))] ring-1 ring-[hsl(var(--gold))]/40"
                      }`}
                    >
                      {badge}
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    {isLifetime ? (
                      <Crown className="w-5 h-5 text-[hsl(var(--gold-bright))]" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-[hsl(var(--gold-bright))]" />
                    )}
                    <h3 className="font-serif text-lg font-bold text-[hsl(40_40%_95%)]">
                      {meta.name}
                    </h3>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-end gap-1.5">
                      <span className="font-serif text-3xl font-bold text-white">
                        {formatRM(amount)}
                      </span>
                      <span className="mb-1 text-sm text-[hsl(40_25%_70%)]">{period}</span>
                    </div>
                    {equiv && (
                      <p className="mt-1 text-xs text-[hsl(var(--gold-bright))]">{equiv}</p>
                    )}
                    <p className="mt-2 text-xs text-[hsl(40_22%_65%)]">{meta.note}</p>
                  </div>

                  <Button
                    onClick={() => startCheckout(tier)}
                    disabled={busy !== null}
                    className={`mt-5 w-full ${
                      highlight || isLifetime
                        ? "bg-[hsl(var(--gold-bright))] text-[hsl(var(--oxford-deep))] hover:bg-[hsl(var(--gold))]"
                        : ""
                    }`}
                    variant={highlight || isLifetime ? "default" : "outline"}
                  >
                    {busy === tier ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {c.starting}
                      </span>
                    ) : isLifetime ? (
                      c.chooseLifetime
                    ) : (
                      c.choose
                    )}
                  </Button>

                  <ul className="mt-6 space-y-2.5 border-t border-white/10 pt-5">
                    {c.features.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[hsl(40_25%_80%)]"
                      >
                        <Check className="mt-0.5 w-4 h-4 shrink-0 text-[hsl(var(--gold-bright))]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
