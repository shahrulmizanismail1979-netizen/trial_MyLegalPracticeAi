type GuidanceKind = "affidavit" | "appeal" | "enforcement";

const guidance: Record<GuidanceKind, {
  title: string;
  prepare: string[];
  review: string[];
  example: string;
  faq: Array<[string, string]>;
}> = {
  affidavit: {
    title: "Affidavit drafting desk guide",
    prepare: [
      "Create a dated chronology and separate what the deponent personally observed from information received from others.",
      "List every intended exhibit, its source, legibility, completeness and the paragraph that will introduce it.",
      "Confirm names, capacities, defined terms and document dates against the source file before generating.",
    ],
    review: [
      "Read each paragraph for a single factual proposition and remove advocacy, speculation or unsupported conclusions.",
      "Check that exhibit references, labels and page order match the assembled exhibit copy.",
      "Recheck the correct court, proceeding details, deponent, language, jurat and local filing requirements.",
    ],
    example: "Useful input: “On [date], I attended [place]. I personally observed [fact]. The email I received from [person] on [date] is attached for context.” Keep unknown details as explicit placeholders.",
    faq: [
      ["Should I paste counsel’s conclusions as facts?", "No. Supply the underlying events and identify their source; review any inference separately."],
      ["Is the generated document filing-ready?", "No. Treat it as a working draft and verify form, evidence, exhibits, execution and registry requirements."],
    ],
  },
  appeal: {
    title: "Appeal preparation desk guide",
    prepare: [
      "Collect the sealed order or decision, reasons, notes, filed cause papers and a clean procedural chronology.",
      "Record each proposed complaint beside the exact passage, evidence or ruling it concerns.",
      "Keep jurisdiction, route, permission questions and dates in a separate verification sheet for current-source checking.",
    ],
    review: [
      "Frame each proposed ground as an identified error and consequence, not a narrative or submission.",
      "Confirm the record supports every factual premise and that requested relief is internally consistent.",
      "Independently verify forum, form, service, fees and every calculated date with current primary and registry sources.",
    ],
    example: "Working structure: “The decision-maker erred in [identified respect] by [specific treatment of issue/evidence], materially affecting [result].” Adapt only after checking the record.",
    faq: [
      ["Can the timeline replace a limitation diary?", "No. It is an organising aid. Calculate and supervise dates independently."],
      ["Should every disagreement become a ground?", "No. Prioritise record-supported errors that matter to the result and obtain practitioner review."],
    ],
  },
  enforcement: {
    title: "Enforcement planning desk guide",
    prepare: [
      "Obtain the sealed order, proof of service where relevant, payment history and an up-to-date balance calculation.",
      "Build an asset-and-information map, recording the source and date of each item rather than treating assumptions as facts.",
      "Note parallel proceedings, insolvency indicators, third-party interests and practical cost or recovery constraints.",
    ],
    review: [
      "Match the proposed method to the exact wording of the order and the verified information available.",
      "Separate principal, interest, costs, credits and disputed sums in the working calculation.",
      "Verify prerequisites, court competence, forms, service and current procedure before taking any step.",
    ],
    example: "Planning note: “Order requires [act/payment]. Outstanding calculation as at [date]: [components]. Verified information: [source/date]. Unknowns requiring inquiry: [items].”",
    faq: [
      ["Does the highest-value method always come first?", "No. Compare evidence, proportionality, cost, recoverability and procedural fit."],
      ["Does a generated recommendation establish asset ownership?", "No. Verify ownership, priority and third-party interests from reliable current material."],
    ],
  },
};

export function PractitionerGuidance({ kind }: { kind: GuidanceKind }) {
  const item = guidance[kind];
  return (
    <section className="rounded-xl border border-border bg-card/50 p-5 space-y-4" data-testid={`guidance-${kind}`}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">Practitioner workflow</p>
        <h2 className="font-serif text-lg font-semibold text-foreground">{item.title}</h2>
        <p className="text-xs text-muted-foreground mt-1">Original preparation aid only—not a court form, legal opinion or current-law confirmation.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div><h3 className="text-sm font-semibold mb-2">Before using the tool</h3><ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">{item.prepare.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><h3 className="text-sm font-semibold mb-2">Review before use</h3><ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">{item.review.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      <div className="rounded-lg bg-muted/40 p-3"><h3 className="text-xs font-semibold mb-1">Input example</h3><p className="text-xs text-muted-foreground">{item.example}</p></div>
      <details className="text-xs"><summary className="cursor-pointer font-semibold text-foreground">Common questions</summary><div className="mt-2 space-y-2">{item.faq.map(([q, a]) => <div key={q}><p className="font-medium">{q}</p><p className="text-muted-foreground">{a}</p></div>)}</div></details>
    </section>
  );
}