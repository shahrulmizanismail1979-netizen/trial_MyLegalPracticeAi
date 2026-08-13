import { Gift, ShieldCheck, Sun, Award, BookMarked } from "lucide-react";

/**
 * Complimentary perks block shown on bundle cards.
 *
 * - The RM 1,000 Academic Support voucher appears on EVERY tier.
 * - The premium trio (life insurance, solar, microcredential) appears only on
 *   2nd-tier-and-above cards, indicated by a non-null `solarKwp`.
 *
 * @param solarKwp  Solar capacity for this tier (4 / 7 / 9.45 kWp), or null for 1st tier.
 */
export function ComplimentaryPerks({ solarKwp }: { solarKwp: number | null }) {
  const premiumPerks = solarKwp !== null
    ? [
        {
          icon: ShieldCheck,
          label: "Life Insurance Policy",
          detail: "(excludes Prudential — your choice of insurer)",
        },
        {
          icon: Sun,
          label: `Solar Power ${solarKwp} kWp Installation`,
          detail: "10-year performance warranty included",
        },
        {
          icon: Award,
          label: "5 Microcredential Courses — 10 pax",
          detail: "Commonwealth Law University, Delaware, U.S.",
        },
      ]
    : [];

  return (
    <div className="mt-4 mb-2 rounded-xl border border-amber-400/50 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-500/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Complimentary Perks
        </span>
      </div>
      <ul className="space-y-3">
        {/* Academic voucher — all tiers */}
        <li className="flex items-start gap-2.5">
          <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 flex items-center justify-center shrink-0 mt-0.5">
            <BookMarked className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-tight">
              RM 1,000 Academic Support Voucher
            </p>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              PhD in Law or Masters by Research — any university
            </p>
          </div>
        </li>

        {/* Premium perks — 2nd tier and above only */}
        {premiumPerks.map(({ icon: Icon, label, detail }, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <div className="h-5 w-5 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 flex items-center justify-center shrink-0 mt-0.5">
              <Icon className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
