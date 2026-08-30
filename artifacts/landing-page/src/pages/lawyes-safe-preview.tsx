import { useEffect, useMemo, useState } from "react";
import {
  AUDIT,
  CHECKLISTS,
  COVERAGE,
  DECISION_TREES,
  NOT_STATED,
  PLAYBOOKS,
  REPORTS,
  SOURCES,
  type Jurisdiction,
  type Playbook,
  type Report,
  exportRecords,
  filterReports,
  reportText,
  validatePublication,
} from "@/fixtures/lawyes-preview";
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  Gavel,
  Home,
  Landmark,
  Menu,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  FileCheck,
  AlertTriangle,
  FolderOpen
} from "lucide-react";

const allFilterFields = [
  ["court", "Court"], ["registry", "Registry"],
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
  const isPending = status === "Access record" || status === "Verification required" || status === "Practitioner-review template";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider ${isPending ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}>
      {status}
    </span>
  );
}

function Provenance({ sourceId, compact = false }: { sourceId: string; compact?: boolean }) {
  const source = SOURCES.find((item) => item.id === sourceId);
  if (!source) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted-foreground ${compact ? "" : "border-t border-border/50 pt-2"}`}>
      {!compact && <SourceBadge status={source.editorialStatus} />}
      <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary transition-colors font-medium">
        {source.name} <ArrowUpRight size={12} />
      </a>
      {!compact && <span>&middot; {source.sourceType} &middot; {source.jurisdiction} &middot; Last verified {source.lastVerified}</span>}
    </div>
  );
}

function Pinpoints({ points }: { points: readonly string[] }) {
  return <>{points.map((point) => <a className="ml-1.5 text-[10px] font-bold text-secondary hover:underline whitespace-nowrap" href={`#p-${point.replace(/[^\w]/g, "")}`} key={point}>&para; {point}</a>)}</>;
}

export function ReportReader({ report, onClose }: { report: Report; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!report.report) {
    return (
      <article className="bg-white border border-border shadow-sm">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-border p-4 flex items-center justify-between">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Access Record</span>
          {onClose && <button onClick={onClose} aria-label="Close selected record" className="p-1 hover:bg-muted text-muted-foreground"><X size={16} /></button>}
        </div>
        <div className="p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl text-foreground font-serif leading-tight mb-6">{report.title}</h2>

          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-8 text-sm text-amber-900 flex gap-3 items-start">
            <CircleAlert size={18} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <strong>Pending verification</strong>
              <p className="mt-1">This record is pending verification and editorial review. It must not be relied on as a LAWYes report.</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs p-5 bg-background border border-border mb-8">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Citation</span>
              <p className="font-mono text-sm">{report.citation || NOT_STATED}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Court &amp; Registry</span>
              <p>{report.court} &middot; {report.registry}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Jurisdiction</span>
              <p>{report.jurisdiction}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Practice area</span>
              <p>{report.practiceAreas.join(", ")}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Source</span>
              <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">{report.sourcePublisher} <ArrowUpRight size={12} /></a>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Source type</span>
              <p>{report.sourceType}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Decision details</span>
              <p>{report.date} &middot; {report.coram} &middot; {report.counsel}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Law as at</span>
              <p>{report.lawAsAt}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Editorial status</span>
              <p>{report.editorialStatus} &middot; reviewed {report.verificationDate}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Reviewer</span>
              <p>{report.reviewer}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Treatment</span>
              <p>{report.treatment}</p>
            </div>
          </div>

          <div className="border border-dashed border-secondary/50 bg-secondary/5 p-5 mb-8 text-sm">
            <strong className="text-secondary block mb-2">Verification gap</strong>
            <p>{report.verificationGap}</p>
          </div>

          <div className="mb-8 text-xs text-muted-foreground">
            <strong className="mb-2 block uppercase tracking-wider">Editorial history</strong>
            {report.revisionHistory.map(item => <p key={item}>{item}</p>)}
          </div>

          <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
            Open source record <ArrowUpRight size={16} />
          </a>
        </div>
      </article>
    );
  }

  const content = report.report;
  const pointIds = [...content.facts, ...content.proceduralHistory, ...content.ratio, ...content.obiter, content.disposition, ...content.issues, ...content.authorities]
    .flatMap((value) => value.pinpoints).filter((point, index, all) => all.indexOf(point) === index);

  const section = (title: string, items: readonly { text: string; pinpoints: readonly string[] }[]) => (
    <section className="mt-8 pt-8 border-t border-border">
      <h3 className="text-lg font-serif mb-4 text-foreground">{title}</h3>
      {items.map((item, index) => <p key={index} className="text-[15px] leading-relaxed text-foreground/80 mb-3">{item.text} <Pinpoints points={item.pinpoints} /></p>)}
    </section>
  );

  return (
    <article className="bg-white border border-border shadow-sm">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-border p-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest hidden sm:inline">Published Preview</span>
          <SourceBadge status={report.status} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => download("lawyes-report.txt", reportText(report), "text/plain")} className="p-1.5 px-3 text-xs font-bold text-primary hover:bg-muted border border-transparent hover:border-border transition-colors flex items-center gap-1.5" type="button"><Download size={13} /> TXT</button>
          <button onClick={() => docxDownload(reportText(report))} className="p-1.5 px-3 text-xs font-bold text-primary hover:bg-muted border border-transparent hover:border-border transition-colors flex items-center gap-1.5" type="button"><Download size={13} /> DOCX</button>
          <button onClick={() => window.print()} className="p-1.5 px-3 text-xs font-bold text-primary hover:bg-muted border border-transparent hover:border-border transition-colors flex items-center gap-1.5" type="button"><Printer size={13} /> Print</button>
          {onClose && <button onClick={onClose} aria-label="Close selected report" className="p-1.5 ml-2 text-muted-foreground hover:bg-muted transition-colors"><X size={16} /></button>}
        </div>
      </div>

      <div className="p-6 md:p-10 max-h-[85vh] overflow-y-auto no-scrollbar scroll-smooth">
        <h2 className="text-2xl md:text-4xl text-foreground font-serif leading-tight mb-8">{report.title}</h2>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-xs p-5 bg-background border-l-4 border-l-secondary mb-8">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Citation</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{report.citation || NOT_STATED}</span>
              <button onClick={() => { navigator.clipboard?.writeText(report.citation || NOT_STATED); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="text-[10px] underline text-primary hover:text-primary/70">{copied ? "Copied" : "Copy"}</button>
            </div>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Decision details</span>
            <p>{report.court} &middot; {report.registry} &middot; {report.date}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Coram &middot; Counsel</span>
            <p>{report.coram} &middot; {report.counsel}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Practice area</span>
            <p>{report.jurisdiction} &middot; {report.practiceAreas.join(", ")}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Source type</span>
            <p>{report.sourceType}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Law as at</span>
            <p>{report.lawAsAt}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Editorial status</span>
            <p>{report.editorialStatus} &middot; reviewed {report.verificationDate}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Reviewer</span>
            <p>{report.reviewer}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Treatment</span>
            <p>{report.treatment}</p>
          </div>
          <div className="sm:col-span-2 pt-3 mt-1 border-t border-border/50">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Official judgment</span>
            <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
              {report.sourcePublisher} &mdash; open report source <ArrowUpRight size={12} />
            </a>
            <Provenance sourceId={SOURCES.find(s => s.name === report.sourcePublisher)?.id ?? ""} />
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 mb-8 bg-background p-2 border border-border" aria-label="Report table of contents">
          {["headnote", "facts", "procedure", "issues", "ratio", "obiter", "orders", "authorities", "paragraphs", "related"].map((id) => (
            <a href={`#${id}`} key={id} className="px-2 py-1 text-[11px] font-bold text-foreground hover:bg-border/50 capitalize transition-colors">
              {id.replace("-", " ")}
            </a>
          ))}
        </nav>

        <section id="headnote">
          <h3 className="text-lg font-serif mb-4 text-foreground">Headnote</h3>
          <p className="text-[15px] leading-relaxed text-foreground/80">{content.headnote}</p>
        </section>

        <div id="facts">{section("Material facts", content.facts)}</div>
        <div id="procedure">{section("Procedural history", content.proceduralHistory)}</div>

        <section id="issues" className="mt-8 pt-8 border-t border-border">
          <h3 className="text-lg font-serif mb-4 text-foreground">Issues and holdings</h3>
          {content.issues.map((item) => (
            <div key={item.issue} className="mb-4">
              <strong className="block text-sm mb-1 text-foreground">{item.issue}</strong>
              <p className="text-[15px] leading-relaxed text-foreground/80">{item.holding} <Pinpoints points={item.pinpoints} /></p>
            </div>
          ))}
        </section>

        <div id="ratio">{section("Ratio decidendi", content.ratio)}</div>
        <div id="obiter">{section("Obiter", content.obiter)}</div>

        <section id="orders" className="mt-8 pt-8 border-t border-border">
          <h3 className="text-lg font-serif mb-4 text-foreground">Orders and costs</h3>
          <p className="text-[15px] leading-relaxed text-foreground/80">{content.disposition.text} <Pinpoints points={content.disposition.pinpoints} /></p>
        </section>

        <section id="authorities" className="mt-8 pt-8 border-t border-border">
          <h3 className="text-lg font-serif mb-4 text-foreground">Legislation</h3>
          <p className="text-[15px] leading-relaxed text-foreground/80 mb-6">{content.legislation.join(" · ")}</p>
          <h3 className="text-lg font-serif mb-4 text-foreground">Authorities and treatment</h3>
          {content.authorities.map((authority) => (
            <p key={authority.name} className="text-[15px] leading-relaxed text-foreground/80 mb-2">
              <strong className="text-foreground font-medium">{authority.name}</strong> &mdash; {authority.treatment} <Pinpoints points={authority.pinpoints} />
            </p>
          ))}
        </section>

        <section id="paragraphs" className="mt-8 pt-8 border-t border-border">
          <h3 className="text-lg font-serif mb-6 text-foreground flex items-center gap-2">
            Verified paragraph pane
            <span className="text-[10px] font-sans font-bold bg-primary/10 text-primary px-2 py-0.5 uppercase tracking-wider">Anchored</span>
          </h3>
          <div className="hidden">{pointIds.map((point) => <span id={`p-${point.replace(/[^\w]/g, "")}`} key={point} />)}</div>
          {content.paragraphs.map((paragraph) => (
            <div id={`judgment-p-${paragraph.number.replace(/[^\w]/g, "")}`} key={paragraph.number} className="flex gap-4 mb-4 hover:bg-background transition-colors p-2 -mx-2 rounded">
              <strong className="text-secondary font-mono text-sm shrink-0 mt-0.5">&para; {paragraph.number}</strong>
              <p className="text-[14px] leading-relaxed text-foreground/90">{paragraph.text}</p>
            </div>
          ))}
        </section>

        <section id="related" className="mt-12 pt-8 border-t border-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Related reports</h3>
          <p className="text-sm text-foreground/80">{REPORTS.filter((item) => item.id !== report.id && item.practiceAreas.some((area) => report.practiceAreas.includes(area))).slice(0, 3).map((item) => item.title).join(" · ") || NOT_STATED}</p>
        </section>

        <section className="mt-8 pt-8 border-t border-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Editorial history</h3>
          <ul className="text-xs text-muted-foreground space-y-2">
            {report.revisionHistory.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      </div>
    </article>
  );
}

type ViewState = "home" | "search" | "draft" | "matter" | "practice" | "verification";

export default function LawYesSafePreview() {
  const [currentView, setCurrentView] = useState<ViewState>("home");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("Sarawak");

  // Search State
  const [filters, setFilters] = useState<Record<string, string>>({ ...blankFilters });
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sort, setSort] = useState("sarawak");

  // Draft State
  const [draftStep, setDraftStep] = useState(1);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [matter, setMatter] = useState("Kuching land verification");
  const [instructions, setInstructions] = useState("");
  const [exhibits, setExhibits] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);
  const [generatedDraft, setGeneratedDraft] = useState("");

  // Matter State
  const [matterStep, setMatterStep] = useState(1);
  const [matterName, setMatterName] = useState("");
  const [matterClient, setMatterClient] = useState("");
  const [matterTask, setMatterTask] = useState("");

  const navigate = (view: ViewState) => {
    setCurrentView(view);
    setMobileNavOpen(false);
    window.history.pushState({ lawyesView: view }, "", window.location.href);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    window.history.replaceState({ lawyesView: "home" }, "", window.location.href);
    const handlePopState = (event: PopStateEvent) => {
      const view = event.state?.lawyesView as ViewState | undefined;
      setCurrentView(view ?? "home");
      setSelectedReport(null);
      setMobileNavOpen(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const activeFilters = { ...filters, jurisdiction };
  const searchResults = useMemo(() => filterReports(REPORTS, activeFilters).sort((left, right) => {
    if (sort === "date") return right.isoDate.localeCompare(left.isoDate);
    if (sort === "court") return left.court.localeCompare(right.court);
    if (sort === "status") return left.status.localeCompare(right.status);
    if (sort === "sarawak") return Number(right.jurisdiction === "Sarawak") - Number(left.jurisdiction === "Sarawak") || left.title.localeCompare(right.title);
    return left.title.localeCompare(right.title);
  }), [activeFilters, sort]);

  const structuredExport = JSON.stringify(exportRecords(searchResults), null, 2);
  const setFilter = (key: string, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const generatePack = () => {
    if (!selectedPlaybook) return;
    setGeneratedDraft([
      "LAWYES SAFE PREVIEW — PRACTITIONER-REVIEW TEMPLATE",
      `Pack: ${selectedPlaybook.title}`, `Matter: ${matter}`, "Jurisdiction: Sarawak",
      "", "INTAKE NOTES", instructions || "Not stated.",
      "", "FACTS / EXHIBITS", exhibits || "Not stated.",
      "", "SOURCE CHECKS", ...selectedPlaybook.sourceIds.map((id) => `- ${SOURCES.find((source) => source.id === id)?.name}: verify current item before reliance`),
      "", "RISK FLAGS", ...selectedPlaybook.riskFlags.map((flag) => `- ${flag}`),
      "", "STRUCTURE", ...selectedPlaybook.structure.map((item) => `- ${item}`),
      "", "This is an editable local template. It is not legal advice, a court form, or a filing confirmation.",
    ].join("\n"));
    setDraftStep(4);
  };

  const handleGlobalSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = fd.get("q") as string;
    setFilters({ ...blankFilters, q, jurisdiction });
    navigate("search");
  };

  return (
    <div className="safe-preview font-sans bg-background text-foreground min-h-[100dvh] flex flex-col">
      {/* Desktop Header */}
      <header className="hidden md:flex items-center justify-between px-8 py-5 border-b border-border bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("home")} className="text-xl font-bold text-foreground flex items-center gap-1 hover:opacity-80 transition-opacity">
            <span className="bg-primary text-white w-8 h-8 flex items-center justify-center font-serif text-lg leading-none">L</span>
            LAW<span className="text-secondary font-serif italic">Yes</span>
          </button>
          <div className="h-5 w-px bg-border mx-2"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Safe Preview</span>
        </div>
        <nav className="flex items-center gap-6">
          <button onClick={() => navigate("search")} className={`text-sm font-medium hover:text-primary transition-colors ${currentView === "search" ? "text-primary border-b-2 border-primary pb-1" : "text-foreground/80"}`}>Search</button>
          <button onClick={() => navigate("draft")} className={`text-sm font-medium hover:text-primary transition-colors ${currentView === "draft" ? "text-primary border-b-2 border-primary pb-1" : "text-foreground/80"}`}>Draft</button>
          <button onClick={() => navigate("matter")} className={`text-sm font-medium hover:text-primary transition-colors ${currentView === "matter" ? "text-primary border-b-2 border-primary pb-1" : "text-foreground/80"}`}>Matter</button>
          <button onClick={() => navigate("practice")} className={`text-sm font-medium hover:text-primary transition-colors ${currentView === "practice" ? "text-primary border-b-2 border-primary pb-1" : "text-foreground/80"}`}>Practice Centre</button>
          <button onClick={() => navigate("verification")} className={`text-[11px] uppercase tracking-wider font-bold hover:text-primary transition-colors ${currentView === "verification" ? "text-primary" : "text-muted-foreground"}`}>Sources &amp; Verification</button>
        </nav>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-border bg-white sticky top-0 z-50">
        <button onClick={() => navigate("home")} className="text-lg font-bold text-foreground flex items-center gap-1">
          <span className="bg-primary text-white w-7 h-7 flex items-center justify-center font-serif text-base leading-none">L</span>
          LAW<span className="text-secondary font-serif italic">Yes</span>
        </button>
        <button onClick={() => setMobileNavOpen(!mobileNavOpen)} className="p-2 -mr-2 text-foreground">
          {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Menu Dropdown */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 top-[61px] bg-white z-40 p-5 flex flex-col gap-4 border-b border-border shadow-lg">
          <button onClick={() => navigate("home")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Home</button>
          <button onClick={() => navigate("search")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Search Law &amp; Cases</button>
          <button onClick={() => navigate("draft")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Draft a Legal Document</button>
          <button onClick={() => navigate("matter")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Work on a Matter</button>
          <button onClick={() => navigate("practice")} className="text-left text-lg font-medium p-3 border-b border-border hover:bg-background">Sarawak Practice Centre</button>
          <button onClick={() => navigate("verification")} className="text-left text-sm font-bold uppercase tracking-wider text-muted-foreground p-3 hover:bg-background mt-4">Sources &amp; Verification</button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto pb-24 md:pb-12">

        {/* --- HOME VIEW --- */}
        {currentView === "home" && (
          <div className="px-5 py-12 md:py-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <span className="inline-block px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-bold uppercase tracking-widest mb-6">Sarawak Practitioner Pathway</span>
              <h1 className="text-4xl md:text-6xl font-serif text-primary leading-[1.1] mb-6">Clarity and provenance for busy practitioners.</h1>
              <p className="text-lg md:text-xl text-foreground/70 leading-relaxed max-w-2xl mx-auto">
                A focused research and drafting workspace. Start with state sources, keep national material in reach, and never mistake an access record for a reviewed report.
              </p>
            </div>

            <div className="max-w-3xl mx-auto mb-16">
              <form onSubmit={handleGlobalSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                  <input
                    name="q"
                    aria-label="Tell LAWYes what you need"
                    type="text"
                    placeholder="Search cases, statutes, or legal concepts..."
                    className="w-full pl-12 pr-4 py-4 bg-white border border-border shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-base"
                  />
                </div>
                <button type="submit" className="px-8 py-4 bg-primary text-white font-medium hover:bg-primary/90 transition-colors whitespace-nowrap">
                  Search Library
                </button>
              </form>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-0">
              <button onClick={() => navigate("search")} className="flex flex-col items-start text-left p-6 bg-white border border-border hover:border-primary/50 hover:shadow-md transition-all group group-hover:-translate-y-1">
                <span className="w-10 h-10 bg-primary/5 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors"><Search size={18} /></span>
                <h3 className="font-serif text-xl text-foreground mb-2">Search Law &amp; Cases</h3>
                <p className="text-sm text-foreground/70 leading-relaxed">Sarawak-first search across judgments, state legislation, and official updates.</p>
              </button>
              <button onClick={() => navigate("draft")} className="flex flex-col items-start text-left p-6 bg-white border border-border hover:border-primary/50 hover:shadow-md transition-all group group-hover:-translate-y-1">
                <span className="w-10 h-10 bg-primary/5 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors"><FileText size={18} /></span>
                <h3 className="font-serif text-xl text-foreground mb-2">Draft a Legal Document</h3>
                <p className="text-sm text-foreground/70 leading-relaxed">Guided intake for civil, criminal, and land practice with integrated source checks.</p>
              </button>
              <button onClick={() => navigate("matter")} className="flex flex-col items-start text-left p-6 bg-white border border-border hover:border-primary/50 hover:shadow-md transition-all group group-hover:-translate-y-1">
                <span className="w-10 h-10 bg-primary/5 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors"><Briefcase size={18} /></span>
                <h3 className="font-serif text-xl text-foreground mb-2">Work on a Matter</h3>
                <p className="text-sm text-foreground/70 leading-relaxed">Organise tasks and verified materials. No data leaves your local browser.</p>
              </button>
              <button onClick={() => navigate("practice")} className="flex flex-col items-start text-left p-6 bg-primary text-white border border-primary hover:bg-primary/90 hover:shadow-md transition-all group group-hover:-translate-y-1">
                <span className="w-10 h-10 bg-white/10 text-white flex items-center justify-center mb-4"><Landmark size={18} /></span>
                <h3 className="font-serif text-xl mb-2">Sarawak Practice Centre</h3>
                <p className="text-sm text-white/80 leading-relaxed">Explore official gateways, checklists, and procedures grouped by practice area.</p>
              </button>
            </div>
          </div>
        )}

        {/* --- SEARCH VIEW --- */}
        {currentView === "search" && (
          <div className="flex flex-col md:flex-row h-full min-h-[calc(100vh-80px)] animate-in fade-in duration-300">
            {/* Filter Sidebar */}
            <aside className={`w-full md:w-[280px] lg:w-[320px] shrink-0 border-r border-border bg-background flex flex-col ${selectedReport ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-5 border-b border-border flex items-center justify-between bg-white">
                <h2 className="font-serif text-lg text-foreground">Search Library</h2>
                <button onClick={() => setFilters({ ...blankFilters, jurisdiction })} className="text-xs font-bold text-primary hover:underline">Reset</button>
              </div>
              <form className="p-5 overflow-y-auto flex-1 no-scrollbar" onSubmit={(event) => event.preventDefault()}>
                <div className="mb-6 bg-white border border-border p-1 flex shadow-sm">
                  {(["Sarawak", "Sabah & Sarawak", "Malaysia"] as Jurisdiction[]).map((option) => (
                    <button
                      type="button"
                      key={option}
                      onClick={() => { setJurisdiction(option); setFilters((current) => ({ ...current, jurisdiction: option })); }}
                      className={`flex-1 text-[11px] font-bold py-2 px-1 text-center transition-colors ${jurisdiction === option ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {option === "Sabah & Sarawak" ? "Sabah/Swk" : option}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="lawyes-search-terms" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Search Terms</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={14} />
                      <input
                        id="lawyes-search-terms"
                        type="text"
                        value={filters.q}
                        onChange={(e) => setFilter("q", e.target.value)}
                        placeholder="e.g. tanah, NCR, negligence..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-border focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lawyes-practice-area" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Practice Area</label>
                    <input
                      id="lawyes-practice-area"
                      type="text"
                      value={filters.practiceArea}
                      onChange={(e) => setFilter("practiceArea", e.target.value)}
                      placeholder="e.g. Civil, Land..."
                      className="w-full px-3 py-2 text-sm bg-white border border-border focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      <span>Advanced Filters</span>
                      <ChevronRight size={16} className={`transition-transform ${showAdvancedFilters ? "rotate-90" : ""}`} />
                    </button>
                  </div>

                  {showAdvancedFilters && (
                    <div className="space-y-4 pt-2 pb-4 animate-in slide-in-from-top-2 duration-200">
                      {allFilterFields.map(([key, label]) => (
                        <div key={key}>
                          <label htmlFor={`lawyes-filter-${key}`} className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</label>
                          <input
                            id={`lawyes-filter-${key}`}
                            type="text"
                            value={filters[key]}
                            onChange={(e) => setFilter(key, e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white border border-border focus:border-primary focus:outline-none"
                          />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="lawyes-filter-from" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">From</label>
                          <input id="lawyes-filter-from" type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className="w-full px-2 py-2 text-xs bg-white border border-border focus:border-primary focus:outline-none" />
                        </div>
                        <div>
                          <label htmlFor="lawyes-filter-to" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">To</label>
                          <input id="lawyes-filter-to" type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className="w-full px-2 py-2 text-xs bg-white border border-border focus:border-primary focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90">
                    Search
                  </button>
                </div>
              </form>
            </aside>

            {/* Results List */}
            <section className={`w-full md:w-[320px] lg:w-[400px] shrink-0 border-r border-border bg-white flex flex-col ${selectedReport ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-border bg-background/50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium"><strong className="text-primary">{searchResults.length}</strong> results</span>
                  <select
                    aria-label="Sort search results"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="text-xs bg-white border border-border py-1 px-2 focus:outline-none"
                  >
                    <option value="sarawak">Sarawak first</option>
                    <option value="title">Title</option>
                    <option value="date">Date</option>
                  </select>
                </div>
                {searchResults.length > 0 && (
                  <div className="flex gap-2">
                    <button onClick={() => download("lawyes-results.csv", ["Title,Citation,Court,Registry,Jurisdiction,Status,Source", ...searchResults.map((record) => [record.title, record.citation, record.court, record.registry, record.jurisdiction, record.status, record.sourcePublisher].map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","))].join("\n"), "text/csv")} className="flex-1 flex justify-center items-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border hover:bg-background transition-colors"><Download size={12}/> CSV</button>
                    <button onClick={() => download("lawyes-records.json", structuredExport, "application/json")} className="flex-1 flex justify-center items-center gap-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border border-border hover:bg-background transition-colors"><Download size={12}/> JSON</button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar bg-background">
                {searchResults.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-muted-foreground mb-4 shadow-sm border border-border"><Search size={20} /></div>
                    <h3 className="font-serif text-lg mb-2">No records found</h3>
                    <p className="text-sm text-muted-foreground">Try a broader term or reset your filters.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {searchResults.map((record) => (
                      <button
                        key={record.id}
                        onClick={() => setSelectedReport(record)}
                        className={`w-full text-left p-4 transition-colors focus:outline-none ${selectedReport?.id === record.id ? 'bg-primary/5 border-l-4 border-l-primary' : 'bg-white hover:bg-background border-l-4 border-l-transparent'}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <SourceBadge status={record.status} />
                          <span className="text-[10px] font-mono text-muted-foreground">{record.isoDate}</span>
                        </div>
                        <h3 className="font-serif text-[15px] leading-tight text-foreground mb-1.5 line-clamp-2">{record.title}</h3>
                        <p className="text-xs text-foreground/70 mb-2">{record.citation || "Unreported"}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{record.court} &middot; {record.registry}</p>
                        <p className="mt-2 text-[10px] font-medium text-muted-foreground">{record.lawAsAt}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Reader Pane */}
            <section className={`flex-1 bg-background relative h-[calc(100vh-140px)] md:h-auto overflow-hidden ${!selectedReport ? 'hidden md:flex md:items-center md:justify-center' : 'block'}`}>
              {selectedReport ? (
                <div className="h-full overflow-y-auto p-4 md:p-6 lg:p-8 w-full bg-background no-scrollbar">
                  <ReportReader report={selectedReport} onClose={() => setSelectedReport(null)} />
                </div>
              ) : (
                <div className="text-center p-8 max-w-sm mx-auto">
                  <BookOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" strokeWidth={1} />
                  <h3 className="font-serif text-xl text-muted-foreground mb-2">Select a record to read</h3>
                  <p className="text-sm text-muted-foreground/70">Detailed provenance, paragraph support, and export options appear here.</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* --- DRAFT VIEW --- */}
        {currentView === "draft" && (
          <div className="px-5 py-8 md:py-12 max-w-4xl mx-auto animate-in fade-in duration-300 min-h-[calc(100vh-160px)]">
            <div className="mb-8 flex items-center justify-between border-b border-border pb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-serif text-foreground">Draft a Legal Document</h1>
                <p className="text-sm text-muted-foreground mt-1">Guided practitioner-review templates.</p>
              </div>
              {draftStep > 1 && (
                <button onClick={() => setDraftStep(step => step - 1)} className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors">
                  <ChevronLeft size={16} /> Back
                </button>
              )}
            </div>

            {draftStep === 1 && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Select Practice Area</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  {["Civil", "Criminal", "Conveyancing / land"].map(track => (
                    <button key={track} onClick={() => {
                        const pb = PLAYBOOKS.find(p => p.track === track);
                        if (pb) { setSelectedPlaybook(pb); setDraftStep(2); }
                      }}
                      className="p-6 bg-white border border-border hover:border-primary text-left transition-all group"
                    >
                      <h3 className="font-serif text-lg text-foreground mb-2 group-hover:text-primary">{track}</h3>
                      <p className="text-xs text-muted-foreground">View available templates &rarr;</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {draftStep === 2 && selectedPlaybook && (
              <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Select Template</h2>
                <button onClick={() => setDraftStep(3)} className="w-full p-6 bg-white border border-border hover:border-primary text-left transition-all flex items-start gap-4">
                  <div className="p-3 bg-primary/5 text-primary shrink-0"><FileCheck size={24} /></div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-serif text-xl text-foreground">{selectedPlaybook.title}</h3>
                      <SourceBadge status={selectedPlaybook.status} />
                    </div>
                    <p className="text-sm text-foreground/70 mb-4">Includes guided intake, cause-paper structure, exhibits, and readiness checks.</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedPlaybook.riskFlags.slice(0,2).map(flag => (
                        <span key={flag} className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-1"><AlertTriangle size={12}/> {flag}</span>
                      ))}
                    </div>
                  </div>
                </button>
              </div>
            )}

            {draftStep === 3 && selectedPlaybook && (
              <div className="bg-white border border-border shadow-sm animate-in slide-in-from-right-4 duration-300">
                <div className="p-6 md:p-8 border-b border-border">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-serif text-2xl">{selectedPlaybook.title}</h2>
                    <SourceBadge status={selectedPlaybook.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">Complete the intake fields below to generate your local working pack.</p>
                </div>

                <div className="p-6 md:p-8 space-y-8 bg-background/50">
                  <div className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
                    <strong className="mb-2 block">Review warnings before drafting</strong>
                    <ul className="space-y-1">
                      {selectedPlaybook.riskFlags.map((flag) => <li key={flag}>&bull; {flag}</li>)}
                    </ul>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="draft-matter-reference" className="block text-[10px] font-bold uppercase tracking-wider text-foreground mb-2">Matter Reference</label>
                      <input id="draft-matter-reference" type="text" value={matter} onChange={(e) => setMatter(e.target.value)} className="w-full p-3 text-sm bg-white border border-border focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                      <label htmlFor="draft-jurisdiction" className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Jurisdiction</label>
                      <input id="draft-jurisdiction" type="text" value="Sarawak" disabled className="w-full p-3 text-sm bg-muted/50 border border-border text-muted-foreground cursor-not-allowed" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="draft-instructions" className="block text-[10px] font-bold uppercase tracking-wider text-foreground mb-2">Instructions &amp; Facts</label>
                    <textarea
                      id="draft-instructions"
                      value={instructions} onChange={(e) => setInstructions(e.target.value)}
                      placeholder="Record facts as supplied; do not add unverified assumptions..."
                      className="w-full p-3 text-sm bg-white border border-border focus:border-primary focus:outline-none min-h-[120px] resize-y"
                    />
                  </div>

                  <div>
                    <label htmlFor="draft-exhibits" className="block text-[10px] font-bold uppercase tracking-wider text-foreground mb-2">Exhibits List</label>
                    <textarea
                      id="draft-exhibits"
                      value={exhibits} onChange={(e) => setExhibits(e.target.value)}
                      placeholder="List exhibits and documents to verify..."
                      className="w-full p-3 text-sm bg-white border border-border focus:border-primary focus:outline-none min-h-[100px] resize-y"
                    />
                  </div>

                  <div className="p-5 bg-white border border-border">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground mb-4">Readiness Gates</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      {["Jurisdiction / registry checked", "Source instrument located", "Facts and exhibits reviewed", "Lawyer sign-off required"].map((label, i) => (
                        <label key={i} className="flex items-start gap-3 cursor-pointer group">
                          <input type="checkbox" checked={checks[i]} onChange={() => setChecks(c => c.map((v, idx) => i === idx ? !v : v))} className="mt-0.5 w-4 h-4 accent-primary text-primary border-border focus:ring-primary" />
                          <span className="text-sm text-foreground/80 group-hover:text-foreground">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button onClick={generatePack} className="px-8 py-3 bg-primary text-white font-medium hover:bg-primary/90 flex items-center gap-2">
                      <Sparkles size={16} /> Generate Preview Pack
                    </button>
                  </div>
                </div>
              </div>
            )}

            {draftStep === 4 && (
              <div className="animate-in slide-in-from-right-4 duration-300">
                <div className="bg-emerald-50 border border-emerald-200 p-4 mb-6 flex items-start gap-3 text-emerald-900">
                  <Check size={20} className="shrink-0 text-emerald-600 mt-0.5" />
                  <div>
                    <strong className="text-sm font-bold block mb-1">Local pack generated successfully</strong>
                    <p className="text-xs">This data has not been saved to any server. Export it now to retain your work.</p>
                  </div>
                </div>

                <div className="bg-white border border-border shadow-sm overflow-hidden">
                  <div className="bg-background border-b border-border p-3 px-4 flex flex-wrap items-center justify-between gap-4">
                    <span className="text-sm font-medium text-foreground">Draft Preview</span>
                    <div className="flex gap-2">
                      <button onClick={() => download("lawyes-pack.txt", generatedDraft, "text/plain")} className="px-3 py-1.5 text-xs font-bold text-foreground bg-white border border-border hover:bg-background flex items-center gap-1.5"><Download size={14}/> TXT</button>
                      <button onClick={() => docxDownload(generatedDraft)} className="px-3 py-1.5 text-xs font-bold text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 flex items-center gap-1.5"><Download size={14}/> DOCX</button>
                      <button onClick={() => window.print()} className="px-3 py-1.5 text-xs font-bold text-foreground bg-white border border-border hover:bg-background flex items-center gap-1.5"><Printer size={14}/> Print</button>
                    </div>
                  </div>
                  <div className="p-6 md:p-8 bg-muted/20">
                    <pre className="text-xs md:text-sm font-mono whitespace-pre-wrap text-foreground/90 leading-relaxed max-h-[60vh] overflow-y-auto p-4 bg-white border border-border shadow-sm no-scrollbar">
                      {generatedDraft}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- MATTER VIEW --- */}
        {currentView === "matter" && (
          <div className="px-5 py-8 md:py-12 max-w-4xl mx-auto animate-in fade-in duration-300 min-h-[calc(100vh-160px)] flex flex-col">
            <div className="mb-6">
              <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider border border-amber-200 mb-3">Demo Matter Flow &middot; No data saved</span>
              <h1 className="text-2xl md:text-3xl font-serif text-foreground">Work on a Matter</h1>
              <p className="text-sm text-muted-foreground mt-1">Organise your research and drafts.</p>
            </div>

            <div className="flex-1 flex flex-col bg-white border border-border shadow-sm">
              <div className="flex border-b border-border bg-background/50 overflow-x-auto no-scrollbar">
                {[1,2,3,4].map(step => (
                  <div key={step} className={`flex-1 py-3 px-4 text-center border-b-2 text-xs font-bold uppercase tracking-wider whitespace-nowrap ${matterStep === step ? 'border-primary text-primary bg-white' : matterStep > step ? 'border-transparent text-foreground' : 'border-transparent text-muted-foreground opacity-50'}`}>
                    Step {step}
                  </div>
                ))}
              </div>

              <div className="p-6 md:p-10 flex-1 bg-background/30">
                {matterStep === 1 && (
                  <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-center mb-8">
                      <FolderOpen size={40} className="mx-auto text-primary mb-3" strokeWidth={1} />
                      <h2 className="font-serif text-xl">Identify the Matter</h2>
                    </div>
                    <div>
                      <label htmlFor="demo-matter-name" className="block text-[10px] font-bold uppercase tracking-wider text-foreground mb-2">Matter Name</label>
                      <input id="demo-matter-name" type="text" value={matterName} onChange={(e) => setMatterName(e.target.value)} placeholder="e.g. Tan Ah Kow Land Dispute" className="w-full p-3 text-sm bg-white border border-border focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                      <label htmlFor="demo-client-reference" className="block text-[10px] font-bold uppercase tracking-wider text-foreground mb-2">Client Reference</label>
                      <input id="demo-client-reference" type="text" value={matterClient} onChange={(e) => setMatterClient(e.target.value)} placeholder="Client name or ID" className="w-full p-3 text-sm bg-white border border-border focus:border-primary focus:outline-none" />
                    </div>
                    <button onClick={() => setMatterStep(2)} disabled={!matterName} className="w-full py-3 bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed mt-4">Next Step</button>
                  </div>
                )}

                {matterStep === 2 && (
                  <div className="max-w-md mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
                     <div className="text-center mb-8">
                      <h2 className="font-serif text-xl">What is the primary task?</h2>
                    </div>
                    <div className="space-y-3">
                      {["Initial Intake / Advice", "Drafting Cause Papers", "Preparing for Hearing", "Closing / Archiving"].map(t => (
                        <button key={t} onClick={() => { setMatterTask(t); setMatterStep(3); }} className={`w-full p-4 text-left border ${matterTask === t ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white hover:border-primary/50'} transition-colors`}>
                          <span className="font-medium">{t}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setMatterStep(1)} className="w-full py-3 text-sm text-muted-foreground hover:text-foreground">Back</button>
                  </div>
                )}

                {matterStep === 3 && (
                  <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="text-center mb-8">
                      <h2 className="font-serif text-xl">Gather Materials</h2>
                      <p className="text-sm text-muted-foreground mt-2">Select published demonstration reports for {matterName}.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 mb-6">
                      {REPORTS.filter(report => report.status === "Published").map((r, i) => (
                        <label key={r.id} className="p-4 border border-border bg-white flex items-start gap-3 cursor-pointer">
                          <input type="checkbox" defaultChecked={i === 0} aria-label={`Select ${r.title}`} className="mt-1 accent-primary" />
                          <div>
                            <p className="text-sm font-medium line-clamp-2 leading-tight mb-1">{r.title}</p>
                            <SourceBadge status={r.status} />
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setMatterStep(2)} className="flex-1 py-3 bg-white border border-border hover:bg-background text-sm font-medium">Back</button>
                      <button onClick={() => setMatterStep(4)} className="flex-[2] py-3 bg-primary text-white font-medium hover:bg-primary/90">Confirm Materials</button>
                    </div>
                  </div>
                )}

                {matterStep === 4 && (
                  <div className="max-w-lg mx-auto text-center space-y-6 animate-in slide-in-from-right-4 duration-300 py-8">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                      <Check size={32} />
                    </div>
                    <h2 className="font-serif text-2xl text-foreground">Matter Setup Complete</h2>
                    <p className="text-foreground/70 text-sm">
                      In the full platform, this creates a secure workspace for <strong>{matterName}</strong> linking verified reports and generated drafts.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 p-4 text-left text-sm text-amber-900 mx-auto mt-8">
                      <strong className="block mb-1">Safe Preview Boundary Reached</strong>
                      This preview does not persist data to our servers. Navigating away will reset this flow.
                    </div>
                    <div className="bg-white border border-border p-4 text-left text-sm mx-auto">
                      <strong className="block mb-1">Next action</strong>
                      Review the selected published reports against the file, then continue with <span className="font-medium">{matterTask || "the chosen legal task"}</span>. Verify every authority and deadline before relying on it.
                    </div>
                    <div className="pt-6">
                       <button onClick={() => { setMatterStep(1); setMatterName(""); setMatterClient(""); setMatterTask(""); }} className="px-6 py-2 border border-border bg-white hover:bg-background text-sm font-medium">Start New Demo</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- PRACTICE CENTRE VIEW --- */}
        {currentView === "practice" && (
          <div className="px-5 py-8 md:py-12 animate-in fade-in duration-300">
            <div className="max-w-4xl mx-auto mb-10 text-center">
              <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-3">Sarawak Practice Centre</h1>
              <p className="text-foreground/70">Navigate the work, not just the case. National Rules of Court and federal material remain distinct from Sarawak sources.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1200px] mx-auto">
              {[
                { name: "Civil Litigation", icon: <Gavel size={20}/>, items: COVERAGE.filter(c => ["civil", "public"].includes(c.id)) },
                { name: "Criminal Litigation", icon: <ShieldCheck size={20}/>, items: COVERAGE.filter(c => ["criminal"].includes(c.id)) },
                { name: "Conveyancing & Land", icon: <Landmark size={20}/>, items: COVERAGE.filter(c => ["land", "commercial", "local-government", "state-regulatory", "insolvency"].includes(c.id)) },
                { name: "NCR & Native Law", icon: <BookOpen size={20}/>, items: COVERAGE.filter(c => ["native"].includes(c.id)) },
                { name: "Probate & Estates", icon: <FileText size={20}/>, items: COVERAGE.filter(c => ["probate", "family"].includes(c.id)) },
                { name: "Professional Practice", icon: <Briefcase size={20}/>, items: COVERAGE.filter(c => ["professional"].includes(c.id)) },
              ].map((category) => (
                <div key={category.name} className="bg-white border border-border shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <div className="p-5 border-b border-border bg-background/50 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 text-primary shrink-0">{category.icon}</div>
                    <h2 className="font-serif text-lg">{category.name}</h2>
                  </div>
                  <div className="p-5 flex-1 space-y-5 bg-white">
                    {category.items.length > 0 ? category.items.map(item => (
                       <div key={item.id}>
                         <div className="flex items-baseline justify-between gap-2 mb-1">
                           <h3 className="font-medium text-sm text-foreground">{item.label}</h3>
                           <SourceBadge status={item.status} />
                         </div>
                         <p className="text-[11px] italic text-muted-foreground mb-2">{item.bmLabel}</p>
                          <p className="text-[11px] text-muted-foreground">Law as at {AUDIT.reviewedOn}</p>
                         <Provenance sourceId={item.sourceId} compact />
                       </div>
                    )) : (
                      <p className="text-sm text-muted-foreground italic">Content currently under review.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Supplemental tools like checklists and trees */}
            <div className="max-w-[1200px] mx-auto mt-12 grid md:grid-cols-2 gap-6">
              <div className="bg-secondary/5 border border-secondary/20 p-6">
                 <h3 className="font-serif text-xl text-secondary mb-4 flex items-center gap-2"><Check size={20} /> Procedural Checklists</h3>
                 <div className="space-y-4">
                   {CHECKLISTS.slice(0,2).map(c => (
                     <details key={c.id} className="group bg-white border border-border p-4 cursor-pointer">
                       <summary className="font-medium text-sm outline-none font-serif">{c.title}</summary>
                       <ul className="mt-3 space-y-2 text-xs text-foreground/80 list-disc pl-4">
                         {c.items.map(i => <li key={i}>{i}</li>)}
                       </ul>
                     </details>
                   ))}
                 </div>
              </div>
              <div className="bg-primary/5 border border-primary/20 p-6">
                 <h3 className="font-serif text-xl text-primary mb-4 flex items-center gap-2"><Sparkles size={20} /> Decision Trees</h3>
                 <div className="space-y-4">
                   {DECISION_TREES.map(dt => (
                     <details key={dt.id} className="group bg-white border border-border p-4 cursor-pointer">
                       <summary className="font-medium text-sm outline-none font-serif">{dt.title}</summary>
                       <ol className="mt-3 space-y-2 text-xs text-foreground/80 list-decimal pl-4">
                         {dt.questions.map(q => <li key={q}>{q}</li>)}
                       </ol>
                     </details>
                   ))}
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* --- VERIFICATION VIEW --- */}
        {currentView === "verification" && (
          <div className="px-5 py-8 md:py-12 max-w-5xl mx-auto animate-in fade-in duration-300">
            <div className="mb-10 text-center">
              <span className="inline-block px-3 py-1 bg-muted/50 text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-4">Review-Ready Audit</span>
              <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-3">Sources &amp; Verification</h1>
              <p className="mb-2 text-base text-foreground/80">What this preview can and cannot claim</p>
              <p className="text-sm text-foreground/70">Reviewed on {AUDIT.reviewedOn}</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-border p-6 text-center">
                <strong className="block text-4xl font-serif text-primary mb-2">{AUDIT.sourcesReviewed}</strong>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sources Reviewed</h3>
                <p className="text-xs text-foreground/70">Official state gateways linked directly.</p>
              </div>
              <div className="bg-white border border-border p-6 text-center">
                <strong className="block text-4xl font-serif text-primary mb-2">{AUDIT.verifiedCurrentAdditions}</strong>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Verified Current</h3>
                <p className="text-xs text-foreground/70">Gateway records only.</p>
              </div>
              <div className="bg-white border border-border p-6 text-center">
                <strong className="block text-4xl font-serif text-primary mb-2">{AUDIT.sarawakSubstantiveReports}</strong>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Substantive Reports</h3>
                <p className="text-xs text-foreground/70">Pending provenance checks.</p>
              </div>
              <div className="bg-white border border-border p-6 text-center">
                <strong className="block text-4xl font-serif text-secondary mb-2">{AUDIT.verificationGaps}</strong>
                <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-2">Verification Gaps</h3>
                <p className="text-xs text-foreground/70">Coverage areas pending review.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-background border border-border p-6 md:p-8">
                <h3 className="font-serif text-xl mb-4 flex items-center gap-2"><ShieldCheck className="text-emerald-600" /> Passed Safeguards</h3>
                <ul className="space-y-3 text-sm text-foreground/80">
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">&bull;</span> All published reports pass source, paragraph, and human approval checks.</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">&bull;</span> Access records cannot export a substantive report.</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">&bull;</span> Source URLs use HTTPS and open in a separate tab.</li>
                  <li className="flex items-start gap-2"><span className="text-emerald-500 mt-0.5">&bull;</span> Preview contains no application-data, account, storage, upload, payment, or server write path.</li>
                </ul>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-6 md:p-8">
                <h3 className="font-serif text-xl text-amber-900 mb-4 flex items-center gap-2"><AlertTriangle /> Production Risks</h3>
                <ul className="space-y-3 text-sm text-amber-800">
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">&bull;</span> No completeness or publisher-equivalence claim is made.</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">&bull;</span> Current legislation, fees, forms, practice directions, and deadlines require item-level verification.</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">&bull;</span> AI-generated material is not auto-published and is visibly separated from reviewed content.</li>
                  <li className="flex items-start gap-2"><span className="text-amber-500 mt-0.5">&bull;</span> This is a review surface only; production data and entitlements are untouched.</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 bg-white border border-border p-6">
              <h3 className="font-serif text-lg mb-4">Audit methodology</h3>
              <p className="text-sm leading-relaxed text-foreground/75">A record is published only when its official source, paragraph support and human approval are all recorded. Gateway availability never upgrades an access record or establishes the currency of an individual instrument. Status changes remain visible in the selected report&apos;s editorial history.</p>
            </div>

            <details className="mt-6 bg-white border border-border p-6">
              <summary className="cursor-pointer font-serif text-lg">Source register and status</summary>
              <div className="mt-5 divide-y divide-border">
                {SOURCES.map(source => (
                  <div key={source.id} className="grid gap-2 py-4 text-sm sm:grid-cols-[1fr_auto]">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">{source.name} <ArrowUpRight size={12} /></a>
                        <SourceBadge status={source.editorialStatus} />
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">{source.sourceType} &middot; {source.rightsStatus}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{source.notes}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Verified {source.lastVerified}</p>
                  </div>
                ))}
              </div>
            </details>

            <details className="mt-6 bg-white border border-border p-6">
              <summary className="cursor-pointer font-serif text-lg">Coverage statistics and technical boundary</summary>
              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                <p><strong>{COVERAGE.length} coverage paths</strong><br /><span className="text-muted-foreground">Every path remains verification-required and is not a completeness claim.</span></p>
                <p><strong>{AUDIT.publishedReports} published reports / {AUDIT.accessRecords} access records</strong><br /><span className="text-muted-foreground">No access record is upgraded without source, paragraph and human checks.</span></p>
                <p className="sm:col-span-2 text-muted-foreground">Static fixture only: no production API, database, authentication, uploads, billing, AI, browser persistence or server writes. Nothing on mylegalpracticeai.life is published or changed by this preview.</p>
              </div>
            </details>
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation (Exactly 4 items) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border flex justify-around items-center h-16 z-50 px-2 pb-safe">
        <button onClick={() => navigate("home")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "home" ? "text-primary" : "text-muted-foreground"}`}>
          <Home size={20} strokeWidth={currentView === "home" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => navigate("search")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "search" ? "text-primary" : "text-muted-foreground"}`}>
          <Search size={20} strokeWidth={currentView === "search" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Search</span>
        </button>
        <button onClick={() => navigate("draft")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "draft" ? "text-primary" : "text-muted-foreground"}`}>
          <FileText size={20} strokeWidth={currentView === "draft" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Draft</span>
        </button>
        <button onClick={() => navigate("matter")} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${currentView === "matter" ? "text-primary" : "text-muted-foreground"}`}>
          <Briefcase size={20} strokeWidth={currentView === "matter" ? 2.5 : 1.5} />
          <span className="text-[10px] font-medium">Matter</span>
        </button>
      </nav>

      {/* Desktop Footer */}
      <footer className="hidden md:block py-6 text-center text-xs text-muted-foreground border-t border-border bg-background mt-auto">
        LAWYes Safe Preview &middot; Sarawak practitioner pathway &middot; Fixture audit {AUDIT.reviewedOn} &middot; Publication gate {REPORTS.every(validatePublication) ? "passed" : "failed"}
      </footer>
    </div>
  );
}
