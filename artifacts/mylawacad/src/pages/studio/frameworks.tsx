import { CinematicShell, PageHeader, SpotlightCard } from "@/components/cinematic-studio";
import { useGetStudioTaxonomies } from "@/lib/api-client";

export default function Frameworks() {
  const { data: taxonomies, isLoading } = useGetStudioTaxonomies();

  return (
    <CinematicShell>
      <PageHeader
        eyebrow="Reference"
        title="Assessment Frameworks"
        description="The pedagogical foundations powering the Assessment Studio rubric designer."
      />

      <div className="container mx-auto px-6 py-12 max-w-5xl space-y-16">
        <section className="grid gap-4 md:grid-cols-3" aria-label="Framework quick start">
          <SpotlightCard className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">1 · Prepare</div>
            <h2 className="font-display text-xl font-bold text-foreground">Start with observable outcomes</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Bring the module outcome, learner stage, teaching already completed, permitted
              materials, answer format and available time. Example: assess whether a learner can
              separate material facts from background facts and explain the distinction.
            </p>
          </SpotlightCard>
          <SpotlightCard className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">2 · Select</div>
            <h2 className="font-display text-xl font-bold text-foreground">Match demand, not decoration</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Use the level descriptions and verbs as design prompts, then inspect the whole
              question. A higher-order verb alone does not make a task complex if the answer can be
              recalled without analysis, judgment or creation.
            </p>
          </SpotlightCard>
          <SpotlightCard className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">3 · Review</div>
            <h2 className="font-display text-xl font-bold text-foreground">Moderate before release</h2>
            <p className="text-sm leading-relaxed text-white/70">
              Ask a colleague to test alignment, ambiguity, accessibility, expected answer and mark
              allocation. Keep the approved outcome map, rubric version and moderation notes with
              the assessment record.
            </p>
          </SpotlightCard>
        </section>

        <SpotlightCard className="space-y-5 border-amber-500/20">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Worked design example</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-foreground">From outcome to reviewable task</h2>
          </div>
          <div className="grid gap-5 text-sm leading-relaxed text-white/70 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-white">Design notes</h3>
              <p>
                Outcome: compare two reasoned approaches to a supplied problem. Inputs: the problem,
                two short extracts, the comparison criteria and word limit. Output: a structured
                comparison that identifies differences, supports each observation from the supplied
                material and states a reasoned preference.
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">Acceptance check</h3>
              <p>
                Confirm that students have what they need, the rubric rewards the stated outcome,
                every criterion is distinguishable and the expected response is feasible. For legal
                education, separately verify any authority, quotation, jurisdiction and currency
                against the course's approved sources.
              </p>
            </div>
          </div>
          <details className="rounded-xl border border-white/10 bg-black/20 p-4">
            <summary className="cursor-pointer font-semibold text-amber-200">Framework FAQ</summary>
            <div className="mt-4 grid gap-4 text-sm leading-relaxed text-white/70 md:grid-cols-2">
              <p><strong className="text-white">Must every question use one level?</strong><br />No. Record the principal demand and use the rubric to make any supporting demands explicit.</p>
              <p><strong className="text-white">Are generated questions ready to publish?</strong><br />No. Treat them as editable proposals and review accuracy, alignment, bias and accessibility.</p>
              <p><strong className="text-white">What should be retained?</strong><br />Keep the final question set, source pack, rubric, settings, moderation decision and approved revisions.</p>
              <p><strong className="text-white">Can confidential material be uploaded?</strong><br />Use authorised, minimised material. Remove personal or client-identifying information unless your institution has approved its use.</p>
            </div>
          </details>
        </SpotlightCard>

        {isLoading ? (
          <div className="text-center py-20 text-gold uppercase tracking-widest text-sm animate-pulse">Loading Academic Monograph...</div>
        ) : (
          taxonomies?.map(tax => (
            <div key={tax.kind} className="space-y-8">
              <div className="border-b border-white/10 pb-6">
                <h2 className="font-display text-4xl font-bold text-foreground mb-2">{tax.title}</h2>
                <h3 className="text-lg text-amber-500/80 font-serif italic">{tax.subtitle}</h3>
                <p className="mt-4 text-muted-foreground leading-relaxed max-w-3xl">{tax.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tax.levels.map((level, i) => (
                  <SpotlightCard key={i} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold/10 text-gold flex items-center justify-center font-display font-bold">
                        {level.level}
                      </div>
                      <h4 className="font-display text-xl font-bold text-foreground">{level.name}</h4>
                    </div>
                    <p className="text-sm text-white/70 leading-relaxed">{level.summary}</p>
                    <div className="pt-3 border-t border-white/5">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Key Verbs</div>
                      <div className="flex flex-wrap gap-2">
                        {level.verbs.map((verb, vi) => (
                          <span key={vi} className="text-xs px-2 py-1 bg-white/5 rounded text-white/80 font-mono">
                            {verb}
                          </span>
                        ))}
                      </div>
                    </div>
                  </SpotlightCard>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </CinematicShell>
  );
}
