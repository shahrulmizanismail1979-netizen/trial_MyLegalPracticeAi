import { useState, useRef, useEffect } from "react";
import {
  ArrowUpRight, X, Download, Printer, CircleAlert
} from "lucide-react";
import {
  SOURCES, type Report, reportText, NOT_STATED
} from "@/fixtures/lawyes-preview";

export function SourceBadge({ status }: { status: string }) {
  const isPending = status === "Access record" || status === "Verification required" || status === "Practitioner-review template";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border text-[10px] font-bold uppercase tracking-wider ${isPending ? "border-muted-foreground/30 bg-muted/50 text-muted-foreground" : "border-primary/20 bg-primary/10 text-primary"}`}>
      {status}
    </span>
  );
}

export function Provenance({ sourceId, compact = false }: { sourceId: string; compact?: boolean }) {
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
  return <>{points.map((point) => (
    <a
      className="ml-1.5 text-[10px] font-bold text-secondary hover:underline whitespace-nowrap"
      href={`#judgment-p-${point.replace(/[^\w]/g, "")}`}
      key={point}
      onClick={(e) => {
        const el = document.getElementById(`judgment-p-${point.replace(/[^\w]/g, "")}`);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth' });
          el.focus({ preventScroll: true });
        }
      }}
    >
      &para; {point}
    </a>
  ))}</>;
}

export function download(name: string, text: string, type: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([text], { type }));
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function docxDownload(text: string) {
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

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    return false;
  }
}

export function ReportReader({ report, onClose }: { report: Report; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [exportFeedback, setExportFeedback] = useState("");
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus({ preventScroll: true });
    }
  }, [report.id]);

  const doExport = (type: "txt" | "docx") => {
    try {
      if (type === "txt") download("lawyes-report.txt", reportText(report), "text/plain");
      if (type === "docx") docxDownload(reportText(report));
      setExportFeedback(`Exported ${type.toUpperCase()} successfully`);
    } catch {
      setExportFeedback(`Failed to export ${type.toUpperCase()}`);
    }
    setTimeout(() => setExportFeedback(""), 3000);
  };

  if (!report.report) {
    return (
      <article ref={containerRef} className="bg-white border-l border-border focus:outline-none h-full flex flex-col" tabIndex={-1}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-border p-4 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">Access Record</span>
          {onClose && <button onClick={onClose} aria-label="Close selected record" className="p-1 hover:bg-muted text-muted-foreground"><X size={16} /></button>}
        </div>
        <div className="p-6 md:p-8 overflow-y-auto flex-1">
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
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Review status</span>
              <p>{report.editorialStatus} &middot; reviewed {report.verificationDate}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Reviewed by</span>
              <p>{report.reviewer}</p>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Authority status</span>
              <p>{report.treatment}</p>
            </div>
          </div>

          <div className="border border-dashed border-secondary/50 bg-secondary/5 p-5 mb-8 text-sm">
            <strong className="text-secondary block mb-2">What still needs checking</strong>
            <p>{report.verificationGap}</p>
          </div>

          <div className="mb-8 text-xs text-muted-foreground">
            <strong className="mb-2 block uppercase tracking-wider">Review history</strong>
            {report.revisionHistory.map((item, i) => <p key={i}>{item}</p>)}
          </div>

          <a href={report.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
            Open source record <ArrowUpRight size={16} />
          </a>
        </div>
      </article>
    );
  }

  const content = report.report;
  const section = (title: string, items: readonly { text: string; pinpoints: readonly string[] }[]) => (
    <section className="mt-8 pt-8 border-t border-border">
      <h3 className="text-lg font-serif mb-4 text-foreground">{title}</h3>
      {items.map((item, index) => <p key={index} className="text-[15px] leading-relaxed text-foreground/80 mb-3">{item.text} <Pinpoints points={item.pinpoints} /></p>)}
    </section>
  );

  return (
    <article ref={containerRef} className="bg-white border-l border-border focus:outline-none h-full flex flex-col" tabIndex={-1}>
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-border p-3 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-secondary uppercase tracking-widest hidden sm:inline">Demonstration report</span>
          <SourceBadge status={report.status} />
          <span aria-live="polite" className="sr-only">{exportFeedback}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => doExport("txt")} aria-label="Export as TXT" className="p-1.5 px-3 text-xs font-bold text-primary hover:bg-muted border border-transparent hover:border-border transition-colors flex items-center gap-1.5 rounded" type="button"><Download size={13} /> TXT</button>
          <button onClick={() => doExport("docx")} aria-label="Export as DOCX" className="p-1.5 px-3 text-xs font-bold text-primary hover:bg-muted border border-transparent hover:border-border transition-colors flex items-center gap-1.5 rounded" type="button"><Download size={13} /> DOCX</button>
          <button onClick={() => { window.print(); setExportFeedback("Print dialog opened"); setTimeout(() => setExportFeedback(""), 3000); }} aria-label="Print" className="p-1.5 px-3 text-xs font-bold text-primary hover:bg-muted border border-transparent hover:border-border transition-colors flex items-center gap-1.5 rounded" type="button"><Printer size={13} /> Print</button>
          {onClose && <button onClick={onClose} aria-label="Close selected report" className="p-1.5 ml-2 text-muted-foreground hover:bg-muted rounded transition-colors"><X size={16} /></button>}
        </div>
      </div>

      <div className="p-6 md:p-10 overflow-y-auto no-scrollbar scroll-smooth flex-1">
        <h2 className="text-2xl md:text-4xl text-foreground font-serif leading-tight mb-8">{report.title}</h2>

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-xs p-5 bg-background border-l-4 border-l-secondary mb-8">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Citation</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{report.citation || NOT_STATED}</span>
              <button
                onClick={async () => {
                  const success = await copyToClipboard(report.citation || NOT_STATED);
                  if (success) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
                aria-label="Copy citation"
                className="text-[10px] underline text-primary hover:text-primary/70 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <span aria-live="polite" className="sr-only">{copied ? "Citation copied to clipboard" : ""}</span>
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
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Review status</span>
            <p>{report.editorialStatus} &middot; reviewed {report.verificationDate}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Reviewed by</span>
            <p>{report.reviewer}</p>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Authority status</span>
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
           {["headnote", "facts", "procedure", "issues", "ratio", "obiter", "orders", "authorities", "paragraphs"].map((id) => (
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
            Judgment paragraphs
            <span className="text-[10px] font-sans font-bold bg-primary/10 text-primary px-2 py-0.5 uppercase tracking-wider">Preview</span>
          </h3>
          {content.paragraphs.map((paragraph) => (
            <div
              id={`judgment-p-${paragraph.number.replace(/[^\w]/g, "")}`}
              key={paragraph.number}
              tabIndex={-1}
              className="flex gap-4 mb-4 hover:bg-background transition-colors p-2 -mx-2 rounded focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <strong className="text-secondary font-mono text-sm shrink-0 mt-0.5">&para; {paragraph.number}</strong>
              <p className="text-[14px] leading-relaxed text-foreground/90">{paragraph.text}</p>
            </div>
          ))}
        </section>

        {/* Since REPORTS is imported, but we don't want cyclic dependency, we can just hide related if not supplied, or supply it. */}

        <section className="mt-8 pt-8 border-t border-border">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Review history</h3>
          <ul className="text-xs text-muted-foreground space-y-2">
            {report.revisionHistory.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      </div>
    </article>
  );
}
