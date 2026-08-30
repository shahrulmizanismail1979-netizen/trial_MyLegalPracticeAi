import { useMemo, useState } from "react";
import {
  AUDIT,
  CHECKLISTS,
  COVERAGE,
  DECISION_TREES,
  GATEWAYS,
  NOT_STATED,
  PLAYBOOKS,
  REPORTS,
  RESOURCES,
  SOURCES,
  type Jurisdiction,
  type Playbook,
  type Report,
  exportRecords,
  filterReports,
  reportText,
  validatePublication,
} from "@/fixtures/lawyes-preview";
import { ArrowUpRight, BookOpen, Check, ChevronRight, CircleAlert, Download, FileText, Gavel, Landmark, Menu, Search, ShieldCheck, Sparkles } from "lucide-react";

const allFilterFields = [
  ["court", "Court"], ["registry", "Registry"], ["practiceArea", "Subject / practice area"],
  ["legislation", "Legislation / section"], ["sourcePublisher", "Source"], ["status", "Report status"],
  ["treatment", "Judicial treatment"], ["catchwords", "Catchwords / terms"],
] as const;

const blankFilters: Record<string, string> = {
  q: "", court: "", registry: "", practiceArea: "", legislation: "", sourcePublisher: "",
  status: "", treatment: "", catchwords: "", from: "", to: "", jurisdiction: "Sarawak",
};

function download(name: string, text: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([text], { type }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function docxDownload(text: string) {
  const enc = new TextEncoder();
  const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const files = [
    ["[Content_Types].xml", "<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"],
    ["_rels/.rels", "<?xml version=\"1.0\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/></Relationships>"],
    ["word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split("\n").map((line) => `<w:p><w:r><w:t>${esc(line)}</w:t></w:r></w:p>`).join("")}<w:sectPr/></w:body></w:document>`],
  ].map(([name, body]) => ({ name, bytes: enc.encode(body) }));
  const u16 = (number: number) => [number & 255, (number >>> 8) & 255];
  const u32 = (number: number) => [number & 255, (number >>> 8) & 255, (number >>> 16) & 255, (number >>> 24) & 255];
  const crc = (bytes: Uint8Array) => {
    let value = -1;
    for (const byte of bytes) {
      value ^= byte;
      for (let index = 0; index < 8; index += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }
    return (value ^ -1) >>> 0;
  };
  let offset = 0;
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  for (const file of files) {
    const name = enc.encode(file.name);
    const checksum = crc(file.bytes);
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(checksum), ...u32(file.bytes.length), ...u32(file.bytes.length), ...u16(name.length), ...u16(0), ...name, ...file.bytes]);
    chunks.push(local);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(checksum), ...u32(file.bytes.length), ...u32(file.bytes.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]));
    offset += local.length;
  }
  const centralSize = central.reduce((size, chunk) => size + chunk.length, 0);
  chunks.push(...central, new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(offset), ...u16(0)]));
  const output = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let position = 0;
  chunks.forEach((chunk) => { output.set(chunk, position); position += chunk.length; });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([output], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  anchor.download = "lawyes-safe-preview-pack.docx";
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function SourceBadge({ status }: { status: string }) {
  return <span className={`source-badge ${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>;
}

function Provenance({ sourceId, compact = false }: { sourceId: string; compact?: boolean }) {
  const source = SOURCES.find((item) => item.id === sourceId);
  if (!source) return null;
  return <div className={compact ? "provenance compact" : "provenance"}>
    <SourceBadge status={source.editorialStatus} />
    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} <ArrowUpRight size={13} /></a>
    {!compact && <span>{source.sourceType} · {source.jurisdiction} · Last verified {source.lastVerified}</span>}
  </div>;
}

function Pinpoints({ points }: { points: readonly string[] }) {
  return <>{points.map((point) => <a className="pin" href={`#p-${point.replace(/[^\w]/g, "")}`} key={point}>¶ {point}</a>)}</>;
}

function ReportReader({ report }: { report: Report }) {
  if (!report.report) {
    return <article className="reader access-reader">
      <p className="eyebrow">ACCESS RECORD · NOT A PUBLISHED REPORT</p>
      <h2>{report.title}</h2>
      <div className="access-notice"><CircleAlert size={18} /> This record is pending verification and editorial review. It must not be relied on as a LAWYes report.</div>
      <ReportMeta report={report} />
      <div className="gap-box"><strong>Verification gap</strong><p>{report.verificationGap}</p></div>
      <a className="source-link" href={report.sourceUrl} target="_blank" rel="noopener noreferrer">Open source record <ArrowUpRight size={15} /></a>
    </article>;
  }
  const content = report.report;
  const pointIds = [...content.facts, ...content.proceduralHistory, ...content.ratio, ...content.obiter, content.disposition, ...content.issues, ...content.authorities]
    .flatMap((value) => value.pinpoints).filter((point, index, all) => all.indexOf(point) === index);
  const section = (title: string, items: readonly { text: string; pinpoints: readonly string[] }[]) => <section><h3>{title}</h3>{items.map((item, index) => <p key={index}>{item.text} <Pinpoints points={item.pinpoints} /></p>)}</section>;
  return <article className="reader">
    <div className="reader-kicker"><span className="eyebrow">PUBLISHED PREVIEW</span><SourceBadge status={report.status} /></div>
    <h2>{report.title}</h2>
    <ReportMeta report={report} />
    <nav className="reader-toc" aria-label="Report table of contents">
      {["headnote", "facts", "procedure", "issues", "ratio", "obiter", "orders", "authorities", "paragraphs", "related"].map((id) => <a href={`#${id}`} key={id}>{id.replace("-", " ")}</a>)}
    </nav>
    <section id="headnote"><h3>Headnote</h3><p>{content.headnote}</p></section>
    <section id="facts">{section("Material facts", content.facts)}</section>
    <section id="procedure">{section("Procedural history", content.proceduralHistory)}</section>
    <section id="issues"><h3>Issues and holdings</h3>{content.issues.map((item) => <p key={item.issue}><strong>{item.issue}</strong><br />{item.holding} <Pinpoints points={item.pinpoints} /></p>)}</section>
    <section id="ratio">{section("Ratio decidendi", content.ratio)}</section>
    <section id="obiter">{section("Obiter", content.obiter)}</section>
    <section id="orders"><h3>Orders and costs</h3><p>{content.disposition.text} <Pinpoints points={content.disposition.pinpoints} /></p></section>
    <section id="authorities"><h3>Legislation</h3><p>{content.legislation.join(" · ")}</p><h3>Authorities and treatment</h3>{content.authorities.map((authority) => <p key={authority.name}><strong>{authority.name}</strong> — {authority.treatment} <Pinpoints points={authority.pinpoints} /></p>)}</section>
    <section id="paragraphs"><h3>Verified paragraph pane</h3><div className="anchor-list">{pointIds.map((point) => <span id={`p-${point.replace(/[^\w]/g, "")}`} key={point} />)}</div>{content.paragraphs.map((paragraph) => <p id={`judgment-p-${paragraph.number.replace(/[^\w]/g, "")}`} key={paragraph.number}><strong>¶ {paragraph.number}</strong> {paragraph.text}</p>)}</section>
    <section id="related"><h3>Related reports</h3><p>{REPORTS.filter((item) => item.id !== report.id && item.practiceAreas.some((area) => report.practiceAreas.includes(area))).slice(0, 3).map((item) => item.title).join(" · ") || NOT_STATED}</p></section>
    <section><h3>Revision history</h3><p>{report.revisionHistory.join(" ")}</p></section>
  </article>;
}

function ReportMeta({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);
  return <div className="report-meta">
    <dl>
      <div><dt>Case identity / citation</dt><dd>{report.citation || NOT_STATED} <button className="inline-action" onClick={() => { navigator.clipboard?.writeText(report.citation || NOT_STATED); setCopied(true); }} type="button">Copy {copied ? "copied" : "citation"}</button></dd></div>
      <div><dt>Court · registry · decision date</dt><dd>{report.court} · {report.registry} · {report.date}</dd></div>
      <div><dt>Coram · counsel</dt><dd>{report.coram} · {report.counsel}</dd></div>
      <div><dt>Jurisdiction · practice areas</dt><dd>{report.jurisdiction} · {report.practiceAreas.join(", ")}</dd></div>
      <div><dt>Source provenance</dt><dd><a href={report.sourceUrl} target="_blank" rel="noopener noreferrer">{report.sourcePublisher} <ArrowUpRight size={13} /></a> · {report.sourceType}</dd></div>
      <div><dt>Law as at / editorial status</dt><dd>{report.lawAsAt} · {report.editorialStatus} · reviewed {report.verificationDate}</dd></div>
    </dl>
  </div>;
}

function ResourceCard({ resource }: { resource: typeof RESOURCES[number] }) {
  return <a className="resource-card" href={SOURCES.find((source) => source.id === resource.sourceId)?.url} target="_blank" rel="noopener noreferrer">
    <div className="card-topline"><SourceBadge status={resource.status} /><span>{resource.category}</span></div>
    <h3>{resource.label}</h3><p>{resource.summary}</p>
    <span className="resource-foot">{resource.jurisdiction} · verified {resource.verifiedDate} <ArrowUpRight size={14} /></span>
  </a>;
}

function PlaybookCard({ playbook, onSelect }: { playbook: Playbook; onSelect: () => void }) {
  return <button className="playbook-card" type="button" onClick={onSelect}>
    <div className="card-topline"><SourceBadge status={playbook.status} /><span>{playbook.track}</span></div>
    <h3>{playbook.title}</h3><p>Guided intake, cause-paper structure, exhibits, readiness checks, and risk flags.</p>
    <span className="resource-foot">Open working pack <ChevronRight size={14} /></span>
  </button>;
}

export default function LawYesSafePreview() {
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("Sarawak");
  const [filters, setFilters] = useState<Record<string, string>>({ ...blankFilters });
  const [selected, setSelected] = useState<Report>(REPORTS[0]);
  const [sort, setSort] = useState("sarawak");
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook>(PLAYBOOKS[0]);
  const [matter, setMatter] = useState("Kuching land verification");
  const [instructions, setInstructions] = useState("");
  const [exhibits, setExhibits] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);
  const [mobileNav, setMobileNav] = useState(false);

  const activeFilters = { ...filters, jurisdiction };
  const results = useMemo(() => filterReports(REPORTS, activeFilters).sort((left, right) => {
    if (sort === "date") return right.isoDate.localeCompare(left.isoDate);
    if (sort === "court") return left.court.localeCompare(right.court);
    if (sort === "status") return left.status.localeCompare(right.status);
    if (sort === "sarawak") return Number(right.jurisdiction === "Sarawak") - Number(left.jurisdiction === "Sarawak") || left.title.localeCompare(right.title);
    return left.title.localeCompare(right.title);
  }), [activeFilters, sort]);
  const structured = JSON.stringify(exportRecords(results), null, 2);
  const isAccessRecord = selected.status === "Access record";
  const setFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const generatePack = () => setDocumentText([
    "LAWYES SAFE PREVIEW — PRACTITIONER-REVIEW TEMPLATE",
    `Pack: ${selectedPlaybook.title}`, `Matter: ${matter}`, "Jurisdiction: Sarawak",
    "", "INTAKE NOTES", instructions || "Not stated.",
    "", "FACTS / EXHIBITS", exhibits || "Not stated.",
    "", "SOURCE CHECKS", ...selectedPlaybook.sourceIds.map((id) => `- ${SOURCES.find((source) => source.id === id)?.name}: verify current item before reliance`),
    "", "RISK FLAGS", ...selectedPlaybook.riskFlags.map((flag) => `- ${flag}`),
    "", "STRUCTURE", ...selectedPlaybook.structure.map((item) => `- ${item}`),
    "", "This is an editable local template. It is not legal advice, a court form, or a filing confirmation.",
  ].join("\n"));

  return <main className="safe-preview">
    <header className="safe-head">
      <a className="safe-brand" href="/">LAW<span>Yes</span></a>
      <span className="safe-head-divider">/</span><strong>SAFE PREVIEW</strong>
      <span className="safe-head-note">Local-only fixture · no account, application-data request, upload, payment, or server write</span>
      <button className="mobile-nav-toggle" onClick={() => setMobileNav((open) => !open)} type="button" aria-expanded={mobileNav} aria-label="Toggle preview navigation"><Menu size={18} /></button>
    </header>
    <nav className={`preview-nav ${mobileNav ? "open" : ""}`} aria-label="Preview navigation">
      <a href="#centre">Practice centre</a><a href="#research">Research library</a><a href="#packs">Packs & playbooks</a><a href="#sources">Source register</a><a href="#audit">Audit</a>
    </nav>

    <section className="safe-hero" id="centre">
      <div className="hero-copy">
        <p className="eyebrow">LAWYES PRACTITIONER PATHWAY · SAFE PREVIEW</p>
        <h1>Sarawak, with the source trail in view.</h1>
        <p className="hero-lede">A focused research and drafting workspace for Sarawak practitioners. Start with state sources, keep national material in reach, and never mistake an access record for a reviewed report.</p>
        <div className="jurisdiction-picker" role="group" aria-label="Choose research jurisdiction">
          <span>Research scope</span>
          {(["Sarawak", "Sabah & Sarawak", "Malaysia"] as Jurisdiction[]).map((option) => <button className={jurisdiction === option ? "active" : ""} key={option} onClick={() => { setJurisdiction(option); setFilters((current) => ({ ...current, jurisdiction: option })); }} type="button">{option}</button>)}
        </div>
      </div>
      <aside className="hero-status">
        <div className="status-orb"><ShieldCheck size={25} /></div>
        <p className="eyebrow">EDITORIAL PROMISE</p>
        <h2>Provenance before polish</h2>
        <p>Published previews require source, paragraph support, and human approval. Everything else stays visible as a gap.</p>
        <a href="#audit">Read the review record <ChevronRight size={15} /></a>
      </aside>
    </section>

    <section className="dashboard-strip" aria-label="Preview dashboard">
      <div><span className="metric-label">Scope</span><strong>{jurisdiction}</strong><small>Sarawak pathway selected</small></div>
      <div><span className="metric-label">Source register</span><strong>{AUDIT.sourcesReviewed} records</strong><small>{AUDIT.verifiedCurrentAdditions} verified-current gateways</small></div>
      <div><span className="metric-label">Reports</span><strong>{AUDIT.publishedReports} published</strong><small>{AUDIT.accessRecords} access records held back</small></div>
      <div><span className="metric-label">Coverage</span><strong>{COVERAGE.length} practice areas</strong><small>No completeness claim</small></div>
    </section>

    <section className="section-block practice-section">
      <div className="section-heading"><div><p className="eyebrow">SARAWAK PRACTICE CENTRE</p><h2>Navigate the work, not just the case</h2></div><span className="section-note">National Rules of Court and federal material remain distinct from Sarawak sources.</span></div>
      <div className="centre-grid">
        <a href="#research" className="centre-card featured"><span className="icon-box"><Search size={20} /></span><div><span className="card-kicker">Research</span><h3>Judgments & reports</h3><p>Sarawak-first search across case names, judges, registries, land terms, sections, and Bahasa Malaysia aliases.</p></div><ChevronRight /></a>
        <a href="#packs" className="centre-card"><span className="icon-box"><FileText size={20} /></span><div><span className="card-kicker">Drafting</span><h3>Packs & playbooks</h3><p>Local templates with guided intake, exhibit lists, source checks, and safe exports.</p></div><ChevronRight /></a>
        <a href="#coverage" className="centre-card"><span className="icon-box"><Landmark size={20} /></span><div><span className="card-kicker">Practice map</span><h3>Coverage & checklists</h3><p>Civil, criminal, land, Native law, estates, family, regulatory, and professional pathways.</p></div><ChevronRight /></a>
        <a href="#sources" className="centre-card"><span className="icon-box"><Gavel size={20} /></span><div><span className="card-kicker">Source trail</span><h3>Registries & updates</h3><p>Official gateways and public professional material with last-verified dates and rights status.</p></div><ChevronRight /></a>
      </div>
    </section>

    <section className="section-block" id="research">
      <div className="section-heading"><div><p className="eyebrow">RESEARCH LIBRARY</p><h2>{jurisdiction}-first case research</h2></div><span className="section-note">Search is local to this fixture. It recognises English and selected Bahasa Malaysia aliases.</span></div>
      <div className="research-layout">
        <aside className="filter-panel">
          <div className="panel-title"><h3>Search & filters</h3><button className="text-button" onClick={() => setFilters({ ...blankFilters, jurisdiction })} type="button">Reset</button></div>
          <label className="search-field"><Search size={17} /><input aria-label="Search cases, statutes, judges, registries" placeholder="Search Sarawak, NCR, tanah..." value={filters.q} onChange={(event) => setFilter("q", event.target.value)} /></label>
          {allFilterFields.map(([key, label]) => <label className="filter-label" key={key}>{label}<input aria-label={label} value={filters[key]} onChange={(event) => setFilter(key, event.target.value)} /></label>)}
          <div className="date-fields"><label className="filter-label">From<input type="date" value={filters.from} onChange={(event) => setFilter("from", event.target.value)} /></label><label className="filter-label">To<input type="date" value={filters.to} onChange={(event) => setFilter("to", event.target.value)} /></label></div>
          <p className="filter-footnote"><ShieldCheck size={14} /> Access control is represented in the fixture; no private content is loaded.</p>
        </aside>
        <section className="results-panel">
          <div className="results-toolbar"><div><span className="result-count">{results.length}</span> records in scope <p>{jurisdiction === "Sarawak" ? "Sarawak records are ranked first; Malaysian records remain one selector away." : "National material is visible and remains labelled by jurisdiction."}</p></div><label className="sort-field">Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="sarawak">Sarawak first</option><option value="title">Title</option><option value="date">Decision date</option><option value="court">Court</option><option value="status">Status</option></select></label></div>
          <div className="exports"><button onClick={() => download("lawyes-results.csv", ["Title,Citation,Court,Registry,Jurisdiction,Status,Source", ...results.map((record) => [record.title, record.citation, record.court, record.registry, record.jurisdiction, record.status, record.sourcePublisher].map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))].join("\n"), "text/csv")} type="button"><Download size={14} /> CSV results</button><button onClick={() => download("lawyes-records.json", structured, "application/json")} type="button"><Download size={14} /> Structured JSON</button></div>
          {results.length === 0 ? <div className="empty-state"><Search size={23} /><h3>No records match this search</h3><p>Try a broader term or reset filters. This preview does not silently widen the selected jurisdiction.</p></div> : <div className="case-list">{results.map((record) => <button className={`case-card ${selected.id === record.id ? "selected" : ""}`} key={record.id} onClick={() => setSelected(record)} type="button"><div className="case-card-top"><SourceBadge status={record.status} /><span>{record.jurisdiction}</span><span>{record.isoDate}</span></div><h3>{record.title}</h3><p>{record.citation || NOT_STATED}</p><p className="case-submeta">{record.court} · {record.registry} · {record.practiceAreas.join(" / ")}</p><Provenance sourceId={SOURCES.find((source) => source.name === record.sourcePublisher)?.id ?? "sarawak-judiciary"} compact /></button>)}</div>}
        </section>
        <div className="reader-wrap">
          <div className="reader-actions">{!isAccessRecord && <><button onClick={() => download("lawyes-report.txt", reportText(selected), "text/plain")} type="button">Text</button><button onClick={() => docxDownload(reportText(selected))} type="button">DOCX</button><button onClick={() => window.print()} type="button">Print / PDF</button></>}</div>
          <ReportReader report={selected} />
        </div>
      </div>
    </section>

    <section className="section-block" id="sources">
      <div className="section-heading"><div><p className="eyebrow">UPDATES, LAW & REGISTRIES</p><h2>Official sources within two clicks</h2></div><a className="section-link" href="#audit">View audit status <ArrowUpRight size={14} /></a></div>
      <div className="resource-grid">{RESOURCES.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}</div>
      <div className="gateway-row"><span>Direct gateways</span>{GATEWAYS.slice(0, 6).map(([name, url]) => <a href={url} key={name} target="_blank" rel="noopener noreferrer">{name} <ArrowUpRight size={13} /></a>)}</div>
    </section>

    <section className="section-block" id="coverage">
      <div className="section-heading"><div><p className="eyebrow">PRACTICE MAP</p><h2>Structured Sarawak coverage</h2></div><span className="section-note">A coverage card is not a legal proposition. Every item below is a source discovery path until reviewed.</span></div>
      <div className="coverage-grid">{COVERAGE.map((item) => <article className="coverage-card" key={item.id}><div><h3>{item.label}</h3><span>{item.bmLabel}</span></div><SourceBadge status={item.status} /><p>{item.coverageNote}</p><Provenance sourceId={item.sourceId} compact /></article>)}</div>
      <div className="decision-grid"><article><div className="card-topline"><Sparkles size={16} /><span>Decision tree</span></div><h3>{DECISION_TREES[0].title}</h3><ol>{DECISION_TREES[0].questions.map((question) => <li key={question}>{question}</li>)}</ol><p className="warning-note">{DECISION_TREES[0].disclaimer}</p></article><article><div className="card-topline"><Check size={16} /><span>Deadline / limitation check</span></div><h3>{CHECKLISTS[0].title}</h3><ul>{CHECKLISTS[0].items.map((item) => <li key={item}>{item}</li>)}</ul><p className="warning-note">{CHECKLISTS[0].deadlineNote}</p></article></div>
    </section>

    <section className="section-block" id="packs">
      <div className="section-heading"><div><p className="eyebrow">PRACTICAL DOCUMENT STUDIO</p><h2>Draft with the gaps in the margin</h2></div><span className="section-note">Templates are editable and review-required. No uploaded files or matter data leave this page.</span></div>
      <div className="packs-layout">
        <div className="playbook-list">{PLAYBOOKS.map((playbook) => <PlaybookCard key={playbook.id} playbook={playbook} onSelect={() => setSelectedPlaybook(playbook)} />)}</div>
        <article className="studio-card">
          <div className="studio-heading"><div><SourceBadge status={selectedPlaybook.status} /><h3>{selectedPlaybook.title}</h3></div><FileText size={24} /></div>
          <div className="studio-grid"><label>Matter / file reference<input value={matter} onChange={(event) => setMatter(event.target.value)} /></label><label>Jurisdiction<select value="Sarawak" disabled><option>Sarawak</option></select></label></div>
          <label>Guided intake and instructions<textarea placeholder="Record facts as supplied by the client; do not add unverified assumptions." value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
          <label>Facts / exhibits<textarea placeholder="List exhibits and facts to verify..." value={exhibits} onChange={(event) => setExhibits(event.target.value)} /></label>
          <div className="studio-checks"><strong>Readiness gates</strong>{["Jurisdiction / registry checked", "Source instrument located", "Facts and exhibits reviewed", "Lawyer sign-off still required"].map((label, index) => <label key={label}><input type="checkbox" checked={checks[index]} onChange={() => setChecks((current) => current.map((value, position) => position === index ? !value : value))} />{label}</label>)}</div>
          <div className="risk-list"><strong>Risk flags</strong>{selectedPlaybook.riskFlags.map((flag) => <span key={flag}><CircleAlert size={14} />{flag}</span>)}</div>
          <div className="studio-actions"><button className="primary-button" onClick={generatePack} type="button"><Sparkles size={15} /> Generate local preview</button>{documentText && <><button onClick={() => download("lawyes-pack.txt", documentText, "text/plain")} type="button">TXT</button><button onClick={() => docxDownload(documentText)} type="button">DOCX</button><button onClick={() => window.print()} type="button">Print / PDF</button></>}</div>
          {documentText && <pre className="draft-preview">{documentText}</pre>}
        </article>
      </div>
    </section>

    <section className="section-block audit-section" id="audit">
      <div className="section-heading"><div><p className="eyebrow">REVIEW-READY AUDIT</p><h2>What this preview can and cannot claim</h2></div><span className="section-note">Reviewed {AUDIT.reviewedOn}</span></div>
      <div className="audit-grid"><article><h3>Sources reviewed</h3><strong>{AUDIT.sourcesReviewed}</strong><p>Official state, Judiciary, registry, Native Courts, and professional gateways are linked directly.</p></article><article><h3>Verified-current additions</h3><strong>{AUDIT.verifiedCurrentAdditions}</strong><p>Gateway records only. Instrument-level updates still require editorial review.</p></article><article><h3>Substantive Sarawak reports</h3><strong>{AUDIT.sarawakSubstantiveReports}</strong><p>None published in this preview. The Kuching land judgment remains an access record pending provenance and paragraph checks.</p></article><article><h3>Verification gaps</h3><strong>{AUDIT.verificationGaps}</strong><p>Coverage, report access, currency, professional-source availability, and registry-specific procedure remain visibly unresolved where applicable.</p></article></div>
      <div className="audit-notes"><div><h3>Passed safeguards</h3><ul><li>All published reports pass source, paragraph, and human approval checks.</li><li>Access records cannot export a substantive report.</li><li>Source URLs use HTTPS and open in a separate tab.</li><li>Preview contains no application-data, account, storage, upload, payment, or server write path.</li></ul></div><div><h3>Production-release risks</h3><ul><li>No completeness or publisher-equivalence claim is made.</li><li>Current legislation, fees, forms, practice directions, and deadlines require item-level verification.</li><li>AI-generated material is not auto-published and is visibly separated from reviewed content.</li><li>This is a review surface only; production data and entitlements are untouched.</li></ul></div></div>
    </section>

    <footer>LAWYes Safe Preview · Sarawak practitioner pathway · Fixture audit {AUDIT.reviewedOn} · <a href="#centre">Back to practice centre</a> · Publication gate {REPORTS.every(validatePublication) ? "passed" : "failed"}</footer>
  </main>;
}