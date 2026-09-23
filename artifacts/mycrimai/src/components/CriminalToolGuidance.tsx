type GuidanceKind = "charge" | "cross" | "document";

const guides: Record<GuidanceKind, { title: string; intake: string[]; review: string[]; example: string; faqs: Array<[string, string]> }> = {
  charge: {
    title: "Charge-analysis preparation",
    intake: ["Paste the charge exactly as supplied; preserve amendments, alternatives and language.", "Add the case stage separately and identify missing source material rather than guessing.", "Collect the relied-on provision from an official current source for independent comparison."],
    review: ["Break the text into alleged conduct, mental element, time, place, identity and stated provision without assuming proof.", "Compare each AI proposition against the actual charge, disclosure and verified primary material.", "Record ambiguities for client or prosecution clarification; do not silently repair the charge."],
    example: "Input note: “Analyse the text as written. Separate express particulars from assumptions. Flag any missing fact and any statutory text that requires current-source verification.”",
    faqs: [["Can the output predict the outcome?", "No. It organises issues; evidence, procedure and professional judgment determine advice."], ["May I rely on the displayed provision?", "Retrieve and verify the operative text and amendment history independently."]],
  },
  cross: {
    title: "Cross-examination working method",
    intake: ["Use a paginated statement and identify the witness’s role, claimed observations and source of knowledge.", "Build a contradiction table using exact passages from statements, exhibits and prior accounts.", "Define the limited propositions each question sequence is intended to establish."],
    review: ["Use short, fact-specific questions and keep the supporting reference beside each question.", "Separate genuine inconsistency from differences caused by context, translation or incomplete records.", "Review fairness, admissibility, privilege, sensitivity and tactical risk before asking any question."],
    example: "Sequence pattern: proposition → source reference → short leading questions → anticipated answer → follow-up reference. Keep disputed interpretation out of the source column.",
    faqs: [["Should every inconsistency be used?", "No. Prioritise material, provable points that advance a defined case theory."], ["Does a generated question establish a foundation?", "No. Confirm the evidential and procedural foundation from the record and current law."]],
  },
  document: {
    title: "Criminal document drafting control",
    intake: ["Select the document type only after confirming the proceeding, court and present case stage.", "Provide a verified chronology, party details, orders, record references and precise relief or purpose.", "Identify confidential or disputed material and mark unknown details with explicit placeholders."],
    review: ["Compare the draft with the correct current local form or approved office precedent line by line.", "Verify every factual assertion, quotation, citation, date and requested order against source material.", "Complete a separate filing check for form, language, signatures, exhibits, service and registry practice."],
    example: "Instruction pattern: “Draft a working [document]. Use only supplied facts. Cite record references in brackets. Insert [VERIFY] for missing particulars and list unresolved inputs at the end.”",
    faqs: [["Is the draft a court-approved form?", "No. It is editable working text and must be transferred into the correct verified format."], ["What if the record conflicts?", "Describe the conflict and request a decision; do not ask the tool to choose facts silently."]],
  },
};

export function CriminalToolGuidance({ kind }: { kind: GuidanceKind }) {
  const g = guides[kind];
  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5 space-y-4" data-testid={`guidance-${kind}`}>
      <div><p className="text-[11px] uppercase tracking-widest font-semibold text-primary">Defence desk guide</p><h2 className="font-serif text-lg font-semibold">{g.title}</h2><p className="text-xs text-muted-foreground mt-1">Original review aid only. It does not state current law, approve a tactic or replace file-specific advice.</p></div>
      <div className="grid md:grid-cols-2 gap-4">
        <div><h3 className="text-sm font-medium mb-2">Prepare the record</h3><ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">{g.intake.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><h3 className="text-sm font-medium mb-2">Human review</h3><ul className="list-disc pl-5 space-y-1.5 text-xs text-muted-foreground">{g.review.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      <div className="rounded-md bg-muted/40 p-3 text-xs"><span className="font-medium">Example workflow: </span><span className="text-muted-foreground">{g.example}</span></div>
      <details className="text-xs"><summary className="cursor-pointer font-medium">Quick FAQ</summary><div className="pt-2 space-y-2">{g.faqs.map(([q, a]) => <div key={q}><p className="font-medium">{q}</p><p className="text-muted-foreground">{a}</p></div>)}</div></details>
    </section>
  );
}