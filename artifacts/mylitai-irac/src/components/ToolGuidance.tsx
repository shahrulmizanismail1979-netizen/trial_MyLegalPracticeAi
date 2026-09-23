type GuidanceKind = "analyzer" | "drafting" | "reply";

const content: Record<GuidanceKind, { title: string; prepare: string[]; test: string[]; example: string; faqs: Array<[string, string]> }> = {
  analyzer: {
    title: "Build a reviewable IRAC record",
    prepare: ["Upload complete, readable documents with stable filenames.", "Add a neutral chronology and identify which facts are agreed, disputed or unknown.", "State the requested analytical question narrowly; separate alternative issues."],
    test: ["Trace every material factual statement to a document and page.", "Open and verify every cited authority; check court, jurisdiction, treatment and currency.", "Test the analysis against the strongest contrary fact and argument before relying on it."],
    example: "Example instruction: “Identify the issues raised by clauses [x–y]. Distinguish express wording, disputed facts and missing evidence. Do not assume the intended remedy.”",
    faqs: [["Why include adverse documents?", "A balanced source set makes omissions and competing interpretations easier to identify."], ["Is an IRAC output an opinion?", "No. It is a structured working aid requiring source verification and professional judgment."]],
  },
  drafting: {
    title: "From template to controlled working draft",
    prepare: ["Use a clean local precedent only after confirming its court, document type and version.", "Provide verified party names, capacities, relief sought and a source-backed chronology.", "Tell the tool what must remain verbatim and mark unknown details as placeholders."],
    test: ["Compare structure, headings and execution blocks line by line with the approved local precedent.", "Check each allegation against instructions and evidence; remove invented connective detail.", "Verify form, language, filing, service, fee and registry requirements independently."],
    example: "Example instruction: “Follow the uploaded heading structure. Draft only sections [A–C]. Use [VERIFY] where the record does not establish a date, amount or capacity.”",
    faqs: [["Can I upload an old office precedent?", "Only as a drafting reference. Confirm that it remains appropriate before use."], ["What should never be silently completed?", "Unknown facts, citations, dates, sums, procedural entitlements and signatures."]],
  },
  reply: {
    title: "Prepare a disciplined reply",
    prepare: ["Create a proposition-by-proposition table of the opponent’s document with page references.", "Classify each point as admitted, denied, not admitted, irrelevant or requiring evidence.", "Identify genuinely new matters; do not use a reply merely to repeat the primary case."],
    test: ["Ensure each response addresses the opponent’s actual proposition rather than a weaker paraphrase.", "Cross-check concessions, defined terms and factual positions against earlier filed material.", "Remove rhetoric and unsupported allegations; verify every authority and record reference."],
    example: "Example instruction: “Respond to paragraphs [x–y]. Quote no more than needed, identify the record reference, and flag any point that requires client confirmation.”",
    faqs: [["Should I upload only the opponent’s document?", "Include the relevant originating material and evidence so consistency can be checked."], ["Can silence be treated as an admission?", "Do not assume that. Decide the response under the applicable procedure after review."]],
  },
};

export function ToolGuidance({ kind }: { kind: GuidanceKind }) {
  const item = content[kind];
  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" data-testid={`guidance-${kind}`}>
      <div><p className="text-[11px] uppercase tracking-widest text-primary font-semibold">Working method</p><h2 className="font-serif text-lg font-semibold">{item.title}</h2><p className="text-xs text-muted-foreground mt-1">Original practitioner checklist; not an official template or substitute for current-source review.</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><h3 className="text-sm font-medium mb-2">Prepare</h3><ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5">{item.prepare.map((x) => <li key={x}>{x}</li>)}</ul></div>
        <div><h3 className="text-sm font-medium mb-2">Quality-control</h3><ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1.5">{item.test.map((x) => <li key={x}>{x}</li>)}</ul></div>
      </div>
      <div className="rounded-md bg-muted/50 p-3 text-xs"><span className="font-medium">Instruction pattern: </span><span className="text-muted-foreground">{item.example}</span></div>
      <details className="text-xs"><summary className="cursor-pointer font-medium">Questions practitioners ask</summary><div className="pt-2 space-y-2">{item.faqs.map(([q, a]) => <div key={q}><p className="font-medium">{q}</p><p className="text-muted-foreground">{a}</p></div>)}</div></details>
    </section>
  );
}