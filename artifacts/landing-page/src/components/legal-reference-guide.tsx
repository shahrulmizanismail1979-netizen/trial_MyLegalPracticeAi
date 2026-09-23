import { legalReferenceGuides } from "@/data/legal-reference-guide";

export function LegalReferenceGuide() {
  return (
    <section className="my-8 space-y-4" aria-labelledby="legal-reference-heading" data-testid="legal-reference-guide">
      <h2 id="legal-reference-heading" className="text-2xl font-serif">Practice checklists &amp; drafting outlines</h2>
      <p className="text-sm text-muted-foreground max-w-3xl">
        Prepare your instructions, identify missing evidence, and structure a working draft.
        These original practice aids are not official court forms, filing-ready precedents,
        or lawyer-approved advice. A source-check date does not certify current law.
      </p>
      {legalReferenceGuides.map((guide) => (
        <details key={guide.id} className="rounded-xl border border-border bg-card p-4 md:p-6" data-testid={`legal-guide-${guide.id}`}>
          <summary className="cursor-pointer font-semibold text-foreground focus-visible:outline-primary">
            {guide.title}
          </summary>
          <div className="mt-4 space-y-6 text-sm leading-relaxed">
            <p><strong>Jurisdiction:</strong> {guide.jurisdiction}</p>
            <p>{guide.scopeNote}</p>
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-slate-800">{guide.caution}</p>
            <div>
              <h3 className="font-semibold mb-2">Before you draft</h3>
              <ul className="list-disc pl-5 space-y-2">
                {guide.practitionerChecklist.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{guide.templateTitle}</h3>
              <p className="text-muted-foreground mb-3">Use these sections as an original working outline. Supply verified facts and sources; do not fill gaps with assumptions.</p>
              <ol className="list-decimal pl-5 space-y-4">
                {guide.templateSections.map((section) => (
                  <li key={section.heading}>
                    <h4 className="font-medium">{section.heading}</h4>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      {section.prompts.map((prompt) => <li key={prompt}>{prompt}</li>)}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Official-source checks and limits</h3>
              <p className="text-muted-foreground mb-3">Read each verification limit. A listed source may be a research starting point or an unsuccessful retrieval—not verified substantive authority.</p>
              <div className="space-y-3">
                {guide.sources.map((source) => (
                  <article key={source.sourceUrl} className="rounded-lg border border-border p-4 space-y-2 break-words">
                    <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">{source.title} (external)</a>
                    <p>{source.authority} · {source.jurisdiction}</p>
                    <p className="text-muted-foreground">Source check: <time dateTime={source.checkedDate}>{source.checkedDate}</time></p>
                    <p><strong>Observed scope:</strong> {source.verifiedUse}</p>
                    <p><strong>Verification limit:</strong> {source.verificationLimit}</p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Review before use</h3>
              <ul className="list-disc pl-5 space-y-2">
                {guide.finalReview.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </details>
      ))}
    </section>
  );
}