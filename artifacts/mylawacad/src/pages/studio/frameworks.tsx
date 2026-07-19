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
