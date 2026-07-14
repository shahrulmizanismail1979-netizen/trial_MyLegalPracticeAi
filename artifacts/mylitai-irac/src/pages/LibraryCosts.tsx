import { Coins, AlertTriangle } from "lucide-react";
import {
  LibraryHeader,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useCostSchedules } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryCosts() {
  const { t } = useLanguage();
  const { data: schedules, isLoading, isError } = useCostSchedules();

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.costs.title")}
        icon={Coins}
        description={t("lib.costs.description")}
      />

      <div className="flex items-start gap-2 card-elegant rounded-xl p-4 mb-8 text-sm text-muted-foreground">
        <AlertTriangle className="w-4 h-4 text-[hsl(var(--gold))] shrink-0 mt-0.5" />
        <p>
          {t("lib.costs.warning")}
        </p>
      </div>

      {isLoading ? (
        <LibraryLoading label={t("lib.costs.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : !schedules || schedules.length === 0 ? (
        <LibraryEmpty message={t("lib.costs.empty")} icon={Coins} />
      ) : (
        <div className="space-y-8">
          {schedules.map((schedule) => (
            <section key={schedule.id} className="card-elegant rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h2 className="font-serif text-2xl font-semibold text-foreground">
                  {schedule.title}
                </h2>
                <Chip variant="gold">{schedule.category}</Chip>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                {schedule.description}
              </p>

              <div className="overflow-x-auto rounded-xl border border-card-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-white/[0.03] text-left">
                      <th className="px-4 py-3 font-semibold text-[hsl(var(--gold))] uppercase text-xs tracking-wider">
                        {t("lib.costs.item")}
                      </th>
                      <th className="px-4 py-3 font-semibold text-[hsl(var(--gold))] uppercase text-xs tracking-wider text-right">
                        {t("lib.costs.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.items.map((item, i) => (
                      <tr
                        key={i}
                        className="border-t border-card-border align-top"
                      >
                        <td className="px-4 py-3 text-foreground/90">
                          {item.description}
                          {item.notes && (
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-foreground whitespace-nowrap">
                          {item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono text-[hsl(var(--gold))]/80">
                  {schedule.legislativeBasis}
                </span>
                {schedule.lastUpdated && (
                  <span>{t("lib.costs.lastUpdated")} {schedule.lastUpdated}</span>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
