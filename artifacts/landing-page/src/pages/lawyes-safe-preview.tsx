import { useMemo, useState } from "react";
import { GATEWAYS, NOT_STATED, REPORTS, type Report, filterReports, exportRecords, reportText, validatePublication } from "@/fixtures/lawyes-preview";
import {
  SARAWAK_PLAYBOOKS,
  SARAWAK_PRECEDENT_PACKS,
  SARAWAK_REGISTRY_LINKS,
  SARAWAK_SOURCE_RECORDS,
  SARAWAK_UPDATES,
  searchSarawakSources,
  sourceById,
  type EditorialState,
} from "@/fixtures/lawyes-sarawak-preview";
import { Search, MapPin, Scale, FileText, CheckCircle2, AlertCircle, ExternalLink, Printer, FileDown, ShieldCheck, Clock, BookOpen, User, Briefcase, FileSignature, CheckSquare, Layers, Layout, Building2, BookMarked, ScrollText, Check, Landmark, Gavel, Library, Route, Languages, FileWarning } from "lucide-react";

const fields = [["party","Party / title"],["case","Case / citation"],["catchwords","Catchwords"],["fullText","Full report text"],["court","Court"],["registry","Registry"],["coram","Judge / coram"],["counsel","Counsel"],["practiceArea","Practice area"],["legislation","Legislation"],["issue","Issue"],["outcome","Outcome"],["treatment","Judicial treatment"],["sourcePublisher","Source publisher"],["status","Status"]] as const;
const blank = {
  ...Object.fromEntries(fields.map(([x]) => [x, ""])),
  from: "",
  to: "",
} as Record<string, string>;

const pin = (points: readonly string[]) => <>{points.map(p => <a className="inline-flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-800 text-[10px] font-bold rounded px-1.5 py-0.5 mx-0.5 no-underline transition-colors align-text-bottom" href={`#p-${p.replace(/[^\w]/g,"")}`} key={p}>¶{p}</a>)}</>;

function download(name: string, text: string, type: string) { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function docxDownload(text: string) {
  const enc=new TextEncoder(), esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;"), files=[
    ["[Content_Types].xml",'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
    ["_rels/.rels",'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
    ["word/document.xml",`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${text.split("\n").map(s=>`<w:p><w:r><w:t>${esc(s)}</w:t></w:r></w:p>`).join("")}<w:sectPr/></w:body></w:document>`],
  ].map(([name,body])=>({name,bytes:enc.encode(body)})); const u16=(n:number)=>[n&255,n>>>8&255],u32=(n:number)=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
  let offset=0; const chunks:Uint8Array[]=[],central:Uint8Array[]=[]; const crc=(b:Uint8Array)=>{let c=-1;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^(0xedb88320&-(c&1));}return(c^-1)>>>0;};
  for(const f of files){const n=enc.encode(f.name),c=crc(f.bytes),local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(f.bytes.length),...u32(f.bytes.length),...u16(n.length),...u16(0),...n,...f.bytes]);chunks.push(local);central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(c),...u32(f.bytes.length),...u32(f.bytes.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]));offset+=local.length;}
  const size=central.reduce((n,x)=>n+x.length,0);chunks.push(...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(size),...u32(offset),...u16(0)])); const out=new Uint8Array(chunks.reduce((n,x)=>n+x.length,0));let p=0;chunks.forEach(x=>{out.set(x,p);p+=x.length;}); const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([out],{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));a.download="lawyes-report.docx";a.click();URL.revokeObjectURL(a.href);
}

function Meta({r}:{r:Report}) { 
  const [copied,setCopied]=useState(false); 
  
  const handleCopy = () => {
    navigator.clipboard?.writeText(r.citation||NOT_STATED);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Item = ({ icon: Icon, label, children }: any) => (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <div className="text-stone-800 text-sm leading-snug">{children}</div>
    </div>
  );

  return (
    <section className="space-y-5">
      <Item icon={BookMarked} label="Citation / Case Number">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{r.citation||NOT_STATED}</span>
          <button 
            onClick={handleCopy} 
            className="text-[10px] uppercase font-bold bg-stone-200 hover:bg-stone-300 text-stone-700 px-2 py-1 rounded transition-colors"
            title="Copy citation"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </Item>
      <Item icon={Building2} label="Court / Registry / Date">
        <div className="font-medium mb-0.5">{r.court}</div>
        <div className="text-stone-600 text-xs">{r.registry} &bull; {r.date}</div>
      </Item>
      <Item icon={User} label="Coram / Counsel">
        <div className="font-medium mb-0.5">{r.coram}</div>
        <div className="text-stone-600 text-xs">{r.counsel}</div>
      </Item>
      <Item icon={Scale} label="Practice Tags">
        <div className="flex flex-wrap gap-1.5 mt-1">
          {r.practiceAreas.map(tag => (
            <span key={tag} className="bg-stone-200 text-stone-700 text-xs font-medium px-2 py-0.5 rounded-sm">{tag}</span>
          ))}
        </div>
      </Item>
      <Item icon={ExternalLink} label="Source">
        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium inline-flex items-center gap-1">
          {r.sourcePublisher} ↗
        </a>
      </Item>
      <Item icon={FileText} label="Full-text Access">
        <span className="text-xs text-stone-600">
          {r.status==="Published" ? "Preview report available; original judgment at official source." : "Official collection gateway; direct document not stated."}
        </span>
      </Item>
      <Item icon={ShieldCheck} label="Status / Reviewer">
        <div className="flex items-center gap-1.5 mb-1.5">
           <span className={`w-2 h-2 rounded-full ${r.status === 'Published' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
           <span className="font-bold">{r.status}</span>
        </div>
        <div className="text-xs text-stone-600">
          {r.reviewer} <br/> {r.verificationDate}
        </div>
      </Item>
    </section>
  ) 
}

function Reader({ r }: {r: Report}) {
  const access = r.status === "Access record";

  const exportActions = !access && (
    <div className="flex gap-2 shrink-0 print:hidden">
      <button onClick={()=>download("lawyes-report.txt",reportText(r),"text/plain")} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-stone-200 rounded hover:bg-stone-50 text-stone-700 shadow-sm transition-colors">
        <FileText className="w-3.5 h-3.5" /> TXT
      </button>
      <button onClick={()=>docxDownload(reportText(r))} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-stone-200 rounded hover:bg-stone-50 text-stone-700 shadow-sm transition-colors">
        <FileDown className="w-3.5 h-3.5" /> DOCX
      </button>
      <button onClick={()=>window.print()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-white border border-stone-200 rounded hover:bg-stone-50 text-stone-700 shadow-sm transition-colors">
        <Printer className="w-3.5 h-3.5" /> Print
      </button>
    </div>
  );

  if (!r.report) return (
    <article className="bg-white shadow-sm border border-stone-200 rounded-xl flex flex-col h-full max-w-4xl mx-auto overflow-hidden print:shadow-none print:border-none">
      <div className="bg-stone-50 border-b border-stone-200 px-6 py-5 md:px-10 md:py-8 shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 leading-tight mb-2">{r.title}</h2>
      </div>
      <div className="p-6 md:p-10 flex-1 overflow-y-auto scrollbar-thin">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-8 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-900 mb-1">Access Record</h3>
            <p className="text-amber-800 text-sm">This record is pending editorial review. It does not imply a substantive LAWYes report or analysis.</p>
          </div>
        </div>
        <div className="max-w-md">
          <Meta r={r} />
        </div>
      </div>
    </article>
  );

  const x = r.report;
  const pointIds = [...x.facts,...x.proceduralHistory,...x.ratio,...x.obiter,x.disposition,...x.issues,...x.authorities].flatMap(v=>v.pinpoints).filter((p,i,a)=>a.indexOf(p)===i);
  const section = (title:string, items: readonly {text:string;pinpoints:readonly string[]}[]) => (
    <section className="mb-10 page-break-inside-avoid">
      <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">{title}</h3>
      <div className="space-y-4">
        {items.map((v,i)=><p key={i} className="text-stone-800 text-base md:text-lg leading-relaxed">{v.text} {pin(v.pinpoints)}</p>)}
      </div>
    </section>
  );

  return (
    <article className="bg-white shadow-sm border border-stone-200 rounded-xl flex flex-col h-full max-w-6xl mx-auto overflow-hidden print:shadow-none print:border-none">
      <header className="bg-stone-50 border-b border-stone-200 px-6 py-5 md:px-10 md:py-8 shrink-0 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified Preview
            </span>
            <span className="text-[10px] font-bold text-stone-500 tracking-widest uppercase">LAWYes Report Reader</span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-bold text-stone-900 leading-tight mb-3">{r.title}</h2>
          <div className="text-stone-600 flex items-center gap-2 text-sm font-medium">
             <BookMarked className="w-4 h-4 text-stone-400" /> {r.citation || NOT_STATED}
          </div>
        </div>
        {exportActions}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col lg:flex-row print:block">
        {/* Main Content Column */}
        <div className="flex-1 font-serif px-6 py-6 md:px-10 md:py-10 max-w-4xl">
          <nav aria-label="Report table of contents" className="flex flex-wrap gap-2 mb-10 p-4 bg-stone-50 rounded-lg border border-stone-200 font-sans text-xs font-bold uppercase tracking-wider print:hidden">
            {[["headnote","Headnote"],["facts","Facts"],["procedural-history","Procedural history"],["issues-holdings","Issues / holdings"],["ratio","Ratio"],["obiter","Obiter"],["orders","Orders"],["legislation-authorities","Legislation / authorities"],["paragraphs","Paragraphs"],["related-reports","Related"],["revision-history","Revision history"]].map(([id,label])=>(
              <a href={`#${id}`} key={id} className="px-3 py-1.5 bg-white border border-stone-200 rounded hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors">
                {label}
              </a>
            ))}
          </nav>

          <section id="headnote" className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Original Headnote</h3>
            <p className="text-stone-800 text-base md:text-lg leading-relaxed italic bg-stone-50 p-5 md:p-6 rounded-r-lg border-l-4 border-[#F5C518]">{x.headnote}</p>
          </section>

          <section id="facts">{section("Material facts",x.facts)}</section>
          <section id="procedural-history">{section("Procedural history",x.proceduralHistory)}</section>

          <section id="issues-holdings" className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Issues and Holdings</h3>
            <div className="space-y-6">
              {x.issues.map(v=>(
                <div key={v.issue} className="bg-stone-50 rounded-lg border border-stone-200 p-5 md:p-6">
                  <p className="font-bold text-stone-900 mb-3 font-sans text-base">{v.issue}</p>
                  <p className="text-stone-800 text-base md:text-lg leading-relaxed">{v.holding} {pin(v.pinpoints)}</p>
                </div>
              ))}
            </div>
          </section>

          <section id="ratio">{section("Ratio decidendi",x.ratio)}</section>
          <section id="obiter">{section("Separate obiter",x.obiter)}</section>

          <section id="orders" className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Disposition, Orders and Costs</h3>
            <p className="text-stone-800 text-base md:text-lg leading-relaxed font-medium bg-stone-100 p-5 rounded-lg border border-stone-200">{x.disposition.text} {pin(x.disposition.pinpoints)}</p>
          </section>

          <section id="legislation-authorities" className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Legislation</h3>
            <p className="text-stone-800 text-base md:text-lg leading-relaxed mb-8">{x.legislation.join(" · ")}</p>
            
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Authorities and Treatment</h3>
            <div className="space-y-2 font-sans text-sm">
              {x.authorities.map(a=>(
                <p key={a.name} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-stone-100 last:border-0">
                  <span className="font-bold text-stone-900 text-base">{a.name}</span>
                  <span className="text-stone-600 bg-stone-100 px-3 py-1.5 rounded text-xs font-medium self-start sm:self-auto">{a.treatment} {pin(a.pinpoints)}</span>
                </p>
              ))}
            </div>
          </section>

          <section id="paragraphs" className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
              Paragraph Pane
              <span className="text-[10px] font-bold tracking-widest text-stone-500 uppercase bg-stone-100 px-2 py-1 rounded">Official Source Alignment</span>
            </h3>
            <div aria-label="Verified pinpoint anchors">{pointIds.map(p=><span id={`p-${p.replace(/[^\w]/g,"")}`} key={p}/>)}</div>
            <div className="space-y-6 font-sans text-sm md:text-base text-stone-700 bg-stone-50 p-6 md:p-8 rounded-xl border border-stone-200">
              {x.paragraphs.map(p=>(
                <p id={`judgment-p-${p.number.replace(/[^\w]/g,"")}`} key={p.number} className="flex gap-4 md:gap-6 group">
                  <b className="text-stone-400 group-hover:text-stone-600 transition-colors shrink-0 w-8 md:w-10 select-none font-mono text-xs md:text-sm pt-0.5">¶ {p.number}</b> 
                  <span className="leading-relaxed text-stone-800">{p.text}</span>
                </p>
              ))}
            </div>
          </section>

          <section id="related-reports" className="mb-10 page-break-inside-avoid">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Related Reports</h3>
            <p className="text-stone-700 font-sans text-sm leading-relaxed">{REPORTS.filter(v=>v.id!==r.id&&v.practiceAreas.some(a=>r.practiceAreas.includes(a))).slice(0,3).map(v=>v.title).join(" · ")||NOT_STATED}</p>
          </section>

          <section id="revision-history" className="mb-10 page-break-inside-avoid print:hidden">
            <h3 className="text-lg font-bold font-sans text-stone-900 mb-4 pb-2 border-b border-stone-200">Revision History</h3>
            <div className="space-y-3 font-sans text-xs text-stone-500">
              {r.revisionHistory.map((hist, i) => (
                <p key={i} className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 shrink-0 text-stone-400" /> <span className="leading-relaxed">{hist}</span>
                </p>
              ))}
            </div>
          </section>
        </div>

        {/* Right Sidebar Column (Metadata) */}
        <aside className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-stone-200 bg-stone-50/50 print:hidden">
          <div className="sticky top-0 p-6 md:p-8 font-sans">
            <h3 className="font-bold text-stone-900 mb-6 pb-3 border-b border-stone-200 flex items-center gap-2 text-base">
               <Layers className="w-4 h-4 text-[#F5C518]" /> Metadata Record
            </h3>
            <Meta r={r} />
          </div>
        </aside>
      </div>
    </article>
  );
}

const editorialTone: Record<EditorialState, string> = {
  "Verified source": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Access record": "bg-blue-100 text-blue-800 border-blue-200",
  "Verification required": "bg-amber-100 text-amber-900 border-amber-200",
};

function StatusBadge({ state }: { state: EditorialState }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${editorialTone[state]}`}>
      {state}
    </span>
  );
}

function PracticeCentre({ jurisdiction }: { jurisdiction: string }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("All");
  const [section, setSection] = useState<"sources" | "playbooks" | "precedents" | "registries">("sources");
  const areas = ["All", ...Array.from(new Set(SARAWAK_SOURCE_RECORDS.flatMap((source) => source.practiceAreas))).sort()];
  const sources = searchSarawakSources(query).filter((source) => area === "All" || source.practiceAreas.includes(area));
  const auditText = [
    "LAWYes SARAWAK SAFE PREVIEW — SOURCE AUDIT",
    "Last verified: 30 August 2026",
    `Jurisdiction pathway: ${jurisdiction}`,
    "",
    `Official or authoritative source records: ${SARAWAK_SOURCE_RECORDS.length}`,
    `Verified source gateways: ${SARAWAK_SOURCE_RECORDS.filter((item) => item.editorialState === "Verified source").length}`,
    `Access records: ${SARAWAK_SOURCE_RECORDS.filter((item) => item.editorialState === "Access record").length}`,
    `Verification-required records: ${SARAWAK_SOURCE_RECORDS.filter((item) => item.editorialState === "Verification required").length}`,
    `Practice playbooks: ${SARAWAK_PLAYBOOKS.length}`,
    `Precedent packs: ${SARAWAK_PRECEDENT_PACKS.length}`,
    "",
    "Release status: SAFE PREVIEW ONLY. No production publication or writes.",
    "Editorial limitation: this audit does not claim complete Sarawak coverage.",
    "",
    ...SARAWAK_SOURCE_RECORDS.map((item) =>
      `${item.title}\n${item.sourceType} | ${item.jurisdiction} | ${item.editorialState}\n${item.currency}\n${item.url}`,
    ),
  ].join("\n\n");

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EA] p-4 md:p-8 lg:p-12" data-testid="view-sarawak-practice-centre">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="rounded-2xl bg-[#102A2A] p-6 text-white shadow-xl md:p-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#F5C518] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#102A2A]">
              Safe Preview
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-200">Law as at 30 August 2026</span>
          </div>
          <h1 className="max-w-4xl font-serif text-3xl font-bold leading-tight md:text-5xl">Sarawak Practice Centre</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-stone-200 md:text-lg">
            A source-led desk for Sarawak advocates: legislation, judgments, registries, land and NCR work,
            Native Courts, professional practice, procedural playbooks and drafting packs.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Curated source records", SARAWAK_SOURCE_RECORDS.length],
              ["Practice playbooks", SARAWAK_PLAYBOOKS.length],
              ["Drafting packs", SARAWAK_PRECEDENT_PACKS.length],
              ["Verified Malaysia preview reports", REPORTS.filter((item) => item.status === "Published").length],
            ].map(([label, value]) => (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4" key={label}>
                <div className="text-2xl font-black text-[#F5C518]">{value}</div>
                <div className="mt-1 text-xs font-bold uppercase tracking-wider text-stone-300">{label}</div>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9A6915]">Latest verified changes</p>
                <h2 className="mt-1 font-serif text-2xl font-bold">Source and editorial change log</h2>
              </div>
              <Clock className="h-6 w-6 text-stone-400" />
            </div>
            <div className="space-y-4">
              {SARAWAK_UPDATES.map((update) => (
                <div className="border-l-2 border-[#F5C518] pl-4" key={update.title}>
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-500">{update.date}</p>
                  <h3 className="mt-1 font-bold text-stone-900">{update.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{update.detail}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <FileWarning className="h-7 w-7 text-amber-700" />
            <h2 className="mt-4 font-serif text-2xl font-bold text-amber-950">Honest coverage, not false completeness</h2>
            <p className="mt-3 text-sm leading-relaxed text-amber-900">
              Fees, timelines, registry customs, forms and provision-level propositions are shown only when directly
              verified. Anything else remains an access record or verification-required workflow.
            </p>
            <button
              type="button"
              onClick={() => download("lawyes-sarawak-source-audit.txt", auditText, "text/plain")}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black"
              data-testid="button-export-sarawak-audit"
            >
              <FileDown className="h-4 w-4" /> Export source audit
            </button>
          </article>
        </section>

        <nav className="flex gap-2 overflow-x-auto rounded-xl border border-stone-200 bg-white p-2 shadow-sm" aria-label="Sarawak Practice Centre sections">
          {[
            ["sources", "Legislation & sources", Library],
            ["playbooks", "Matter playbooks", Route],
            ["precedents", "Precedent packs", FileSignature],
            ["registries", "Registries & agencies", Landmark],
          ].map(([value, label, Icon]) => (
            <button
              type="button"
              key={String(value)}
              onClick={() => setSection(value as typeof section)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition ${
                section === value ? "bg-[#102A2A] text-[#F5C518]" : "text-stone-600 hover:bg-stone-100"
              }`}
              data-testid={`button-centre-${String(value)}`}
            >
              <Icon className="h-4 w-4" /> {String(label)}
            </button>
          ))}
        </nav>

        {section === "sources" && (
          <section className="space-y-5">
            <div className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 md:grid-cols-[1fr_260px]">
              <label className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-stone-400" />
                <span className="sr-only">Search Sarawak sources</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search Land Code, NCR, probate, registry, advocate, adat..."
                  className="w-full rounded-lg border border-stone-300 py-2.5 pl-10 pr-3 text-sm"
                  data-testid="input-sarawak-source-search"
                />
              </label>
              <label>
                <span className="sr-only">Filter by practice area</span>
                <select
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
                  data-testid="select-sarawak-practice-area"
                >
                  {areas.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <p className="text-sm font-bold text-stone-600" role="status">{sources.length} source records shown</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sources.map((source) => (
                <article className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm" key={source.id} data-testid={`card-source-${source.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <StatusBadge state={source.editorialState} />
                    <span className="text-right text-[10px] font-bold uppercase tracking-wider text-stone-500">{source.jurisdiction}</span>
                  </div>
                  <h3 className="mt-4 font-serif text-xl font-bold leading-tight">{source.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">{source.summary}</p>
                  <dl className="mt-5 space-y-3 border-t border-stone-100 pt-4 text-xs">
                    <div><dt className="font-black uppercase tracking-wider text-stone-400">Source type</dt><dd className="mt-1 text-stone-700">{source.sourceType}</dd></div>
                    <div><dt className="font-black uppercase tracking-wider text-stone-400">Currency</dt><dd className="mt-1 text-stone-700">{source.currency}</dd></div>
                    <div><dt className="font-black uppercase tracking-wider text-stone-400">Last verified</dt><dd className="mt-1 text-stone-700">{source.lastVerified}</dd></div>
                  </dl>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex items-center justify-between rounded-lg bg-stone-100 px-3 py-2.5 text-sm font-bold text-[#075B73] hover:bg-stone-200"
                    data-testid={`link-source-${source.id}`}
                  >
                    Open official source <ExternalLink className="h-4 w-4" />
                  </a>
                </article>
              ))}
            </div>
            {sources.length === 0 && (
              <div className="rounded-xl border border-stone-200 bg-white p-10 text-center" role="status">
                <AlertCircle className="mx-auto h-8 w-8 text-stone-300" />
                <p className="mt-3 font-bold">No verified source records match.</p>
                <button type="button" onClick={() => { setQuery(""); setArea("All"); }} className="mt-4 rounded-lg bg-stone-900 px-4 py-2 text-sm font-bold text-white">Clear search</button>
              </div>
            )}
          </section>
        )}

        {section === "playbooks" && (
          <section className="grid gap-4 lg:grid-cols-2">
            {SARAWAK_PLAYBOOKS.map((playbook) => (
              <article className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm" key={playbook.id}>
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider text-[#9A6915]">{playbook.area}</span><StatusBadge state={playbook.editorialState} /></div>
                <h2 className="mt-3 font-serif text-2xl font-bold">{playbook.title}</h2>
                <div className="mt-4 rounded-lg border-l-4 border-[#F5C518] bg-stone-50 p-4 text-sm leading-relaxed"><strong>Jurisdiction check:</strong> {playbook.jurisdictionCheck}</div>
                <ol className="mt-5 space-y-3">
                  {playbook.steps.map((step, index) => <li className="flex gap-3 text-sm leading-relaxed text-stone-700" key={step}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#102A2A] text-xs font-bold text-[#F5C518]">{index + 1}</span>{step}</li>)}
                </ol>
                <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-900"><strong>Risk flags:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{playbook.riskFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul></div>
                <div className="mt-5 flex flex-wrap gap-2">{playbook.sourceIds.map((id) => { const source = sourceById(id); return source ? <a className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800" href={source.url} target="_blank" rel="noopener noreferrer" key={id}>{source.title} ↗</a> : null; })}</div>
              </article>
            ))}
          </section>
        )}

        {section === "precedents" && (
          <section className="grid gap-4 lg:grid-cols-2">
            {SARAWAK_PRECEDENT_PACKS.map((pack) => (
              <article className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm" key={pack.id}>
                <div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider text-[#9A6915]">{pack.area}</span><StatusBadge state={pack.editorialState} /></div>
                <h2 className="mt-3 font-serif text-2xl font-bold">{pack.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{pack.description}</p>
                {[["Guided intake", pack.intake], ["Required facts and exhibits", pack.exhibits], ["Filing and service checks", pack.filingChecks]].map(([title, items]) => (
                  <div className="mt-5" key={String(title)}><h3 className="text-xs font-black uppercase tracking-wider text-stone-500">{String(title)}</h3><ul className="mt-2 space-y-2 text-sm text-stone-700">{(items as readonly string[]).map((item) => <li className="flex gap-2" key={item}><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />{item}</li>)}</ul></div>
                ))}
                <div className="mt-5 flex flex-wrap gap-2">{pack.sourceIds.map((id) => { const source = sourceById(id); return source ? <a className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800" href={source.url} target="_blank" rel="noopener noreferrer" key={id}>{source.title} ↗</a> : null; })}</div>
                <button
                  type="button"
                  onClick={() => docxDownload(`${pack.title}\n\nStatus: ${pack.editorialState}\nPractitioner review required.\n\nGuided intake\n${pack.intake.map((item) => `□ ${item}`).join("\n")}\n\nRequired facts and exhibits\n${pack.exhibits.map((item) => `□ ${item}`).join("\n")}\n\nFiling and service checks\n${pack.filingChecks.map((item) => `□ ${item}`).join("\n")}`)}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#102A2A] px-4 py-2.5 text-sm font-bold text-[#F5C518]"
                >
                  <FileDown className="h-4 w-4" /> Export guided DOCX
                </button>
              </article>
            ))}
          </section>
        )}

        {section === "registries" && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SARAWAK_REGISTRY_LINKS.map((registry) => {
              const source = sourceById(registry.sourceId);
              return (
                <article className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm" key={registry.name}>
                  <MapPin className="h-6 w-6 text-[#9A6915]" />
                  <h2 className="mt-4 font-serif text-2xl font-bold">{registry.name}</h2>
                  <p className="mt-2 text-sm text-stone-600">{registry.kind}</p>
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Verify the current filing channel, fee, form, listing practice and contact directly. The preview does not infer local practice.</p>
                  {source && <a className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#075B73]" href={source.url} target="_blank" rel="noopener noreferrer">Open official directory <ExternalLink className="h-4 w-4" /></a>}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

export default function LawYesSafePreview() {
  const [view, setView] = useState<'centre'|'research'|'matter'>('centre');
  const [jurisdiction, setJurisdiction] = useState("Sarawak");
  const [filters,setFilters]=useState(blank);
  const [selected,setSelected]=useState<Report>(REPORTS[0]);
  const [sort,setSort]=useState("title");
  
  const [matter,setMatter]=useState("SFI access research");
  const [instruction,setInstruction]=useState("Prepare local research note.");
  const [doc,setDoc]=useState("Affidavit");
  const [checks,setChecks]=useState([false,false,false]);
 
  const results = useMemo(()=>filterReports(REPORTS,filters).sort((a,b)=>sort==="date"?a.isoDate.localeCompare(b.isoDate):sort==="court"?a.court.localeCompare(b.court):a.title.localeCompare(b.title)),[filters,sort]);
  const structured = JSON.stringify(exportRecords(results),null,2); 
  const access = selected.status==="Access record";
  
  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-stone-50 font-sans text-stone-900 safe-preview">
      
      {/* Sidebar */}
      <aside className="w-full md:w-[280px] lg:w-[320px] bg-[#0A1118] text-stone-300 flex flex-col border-b md:border-b-0 md:border-r border-[#152330] shrink-0 h-auto md:h-screen md:overflow-y-auto scrollbar-dark print:hidden">
        {/* Logo Area */}
        <div className="p-6 md:p-8 border-b border-[#152330] shrink-0">
          <a href="/" className="inline-block text-3xl font-serif font-bold text-white tracking-tight hover:opacity-90 transition-opacity">
            LAW<span className="text-[#F5C518]">Yes</span>
          </a>
          <div className="mt-1 text-[10px] font-bold text-[#F5C518] uppercase tracking-widest">
            Sarawak Practitioner Desk
          </div>
          <div className="mt-5 bg-[#152330] text-stone-300 text-[11px] p-3 rounded border border-[#1E3042] leading-relaxed">
            <div className="flex items-center gap-1.5 font-bold text-white mb-1 uppercase tracking-wider text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F5C518]" />
              Safe Preview Mode
            </div>
            Local fixture only. No network, storage, or external API calls.
          </div>
        </div>

        <div className="p-4 md:p-8 space-y-6 md:space-y-8 flex-1">
          {/* Navigation */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3 px-1">Workspace</h3>
             <button onClick={() => setView('centre')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${view === 'centre' ? 'bg-[#F5C518] text-[#0A1118]' : 'hover:bg-[#152330] text-stone-400'}`} data-testid="button-view-practice-centre">
               <Landmark className="w-4 h-4" />
               Sarawak Practice Centre
             </button>
            <button onClick={() => setView('research')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${view === 'research' ? 'bg-[#F5C518] text-[#0A1118]' : 'hover:bg-[#152330] text-stone-400'}`}>
              <Search className="w-4 h-4" />
              Source-led Research
            </button>
            <button onClick={() => setView('matter')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all ${view === 'matter' ? 'bg-[#F5C518] text-[#0A1118]' : 'hover:bg-[#152330] text-stone-400'}`}>
              <Briefcase className="w-4 h-4" />
              Matter Studio
            </button>
          </div>

           <div>
             <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3 px-1">Jurisdiction</h3>
             <label className="block">
               <span className="sr-only">Choose jurisdiction pathway</span>
               <select
                 value={jurisdiction}
                 onChange={(event) => setJurisdiction(event.target.value)}
                 className="w-full rounded-lg border border-[#1E3042] bg-[#0A1118] px-3 py-3 text-sm font-bold text-white focus:border-[#F5C518] focus:outline-none"
                 data-testid="select-jurisdiction"
               >
                 <option>Sarawak</option>
                 <option>Malaysia — national material</option>
               </select>
             </label>
             <p className="mt-2 px-1 text-[11px] leading-relaxed text-stone-500">
               Sarawak is a first-class pathway. Federal material remains visible where it applies.
             </p>
           </div>

          {/* Registries Filter */}
          {view === 'research' && (
            <div className="space-y-1.5">
              <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3 px-1 flex justify-between items-center">
                Sarawak Registries
                {filters.registry && (
                  <button onClick={() => setFilters({...filters, registry: ""})} className="text-[#F5C518] hover:underline normal-case tracking-normal">Clear</button>
                )}
              </h3>
              {["All Registries", "Kuching", "Sibu", "Miri", "Bintulu", "Kota Kinabalu", "Labuan"].map(reg => {
                const isActive = (filters.registry === reg || (reg === "All Registries" && !filters.registry));
                return (
                  <button key={reg} onClick={() => setFilters({...filters, registry: reg === "All Registries" ? "" : reg})}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all ${
                      isActive ? 'bg-[#152330] text-[#F5C518] font-bold border border-[#1E3042]' : 'hover:bg-[#152330] text-stone-400 border border-transparent font-medium'
                    }`}>
                    <div className="flex items-center gap-3">
                      <MapPin className={`w-4 h-4 ${isActive ? 'text-[#F5C518]' : 'opacity-50'}`} />
                      {reg}
                    </div>
                    {isActive && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Advanced Filters */}
          {view === 'research' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3 px-1 flex justify-between items-center">
                Search Library
                <button onClick={() => setFilters(blank)} className="text-[#F5C518] hover:underline normal-case tracking-normal">Clear All</button>
              </h3>
              <div className="space-y-3">
                {fields.map(([key, label]) => {
                  if (key === 'registry') return null; // handled above
                  return (
                    <div key={key}>
                      <label className="block text-[11px] font-bold text-stone-400 mb-1.5 px-1">{label}</label>
                      <input 
                        type="text" 
                        value={filters[key]} 
                        onChange={e => setFilters({...filters, [key]: e.target.value})}
                        className="w-full bg-[#0A1118] border border-[#1E3042] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all placeholder:text-stone-700"
                        placeholder={`Search ${label.toLowerCase()}...`}
                      />
                    </div>
                  )
                })}
              </div>
              
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1.5 px-1">From</label>
                  <input type="date" value={filters.from ?? ""} onChange={e=>setFilters({...filters,from:e.target.value})} className="w-full bg-[#0A1118] border border-[#1E3042] text-stone-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-400 mb-1.5 px-1">To</label>
                  <input type="date" value={filters.to ?? ""} onChange={e=>setFilters({...filters,to:e.target.value})} className="w-full bg-[#0A1118] border border-[#1E3042] text-stone-300 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518] transition-all" />
                </div>
              </div>
            </div>
          )}

          {/* Gateways */}
          <div className="hidden md:block space-y-2 pt-6 border-t border-[#152330]">
            <h3 className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-3 px-1">Official Gateways</h3>
            {GATEWAYS.map(([n,u]) => (
              <a key={n} href={u} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-stone-400 hover:text-white transition-colors group rounded hover:bg-[#152330]">
                <span className="truncate">{n}</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-30 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
              </a>
            ))}
          </div>
          
          <div className="pt-6 border-t border-[#152330] px-1 text-[10px] text-stone-600 font-medium">
             Publication gate validation: {REPORTS.every(validatePublication)?"passed":"failed"}.
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      {view === 'research' ? (
        <div className="flex flex-col md:flex-row flex-1 h-auto md:h-screen overflow-hidden">
           {/* Results List */}
           <div className="w-full md:w-[320px] lg:w-[380px] shrink-0 bg-stone-50 border-b md:border-b-0 md:border-r border-stone-200 flex flex-col h-[50vh] md:h-full overflow-hidden print:hidden">
              <div className="p-4 md:p-6 border-b border-stone-200 bg-white shrink-0 shadow-sm z-10">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold text-stone-900 flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-4 text-[#F5C518]" />
                    {results.length} records
                  </h2>
                  <select value={sort} onChange={e=>setSort(e.target.value)} className="bg-stone-100 border-none text-xs font-semibold rounded px-2 py-1.5 text-stone-700 focus:ring-0 cursor-pointer">
                    <option value="title">Sort by Title</option>
                    <option value="court">Sort by Court</option>
                    <option value="date">Sort by Date</option>
                  </select>
                </div>
                
                {/* Exports */}
                <div className="flex gap-2">
                  <button onClick={() => download("lawyes-results.csv",["Title,Citation,Court,Status",...results.map(r=>`"${r.title.replace(/"/g,'""')}","${r.citation}","${r.court}","${r.status}"`)].join("\n"),"text/csv")} 
                    className="flex-1 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-[10px] uppercase font-bold py-2 px-2 rounded-lg inline-flex justify-center items-center gap-1.5 transition-colors shadow-sm">
                    <FileDown className="w-3.5 h-3.5 text-stone-400" /> CSV
                  </button>
                  <button onClick={() => download("lawyes-report.json",structured,"application/json")} 
                    className="flex-1 bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-[10px] uppercase font-bold py-2 px-2 rounded-lg inline-flex justify-center items-center gap-1.5 transition-colors shadow-sm">
                    <FileDown className="w-3.5 h-3.5 text-stone-400" /> JSON
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 bg-stone-50/50">
                {results.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200 mt-4 shadow-sm">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 text-stone-300" />
                    <p className="text-sm font-bold text-stone-700">No reports match.</p>
                    <p className="text-xs mt-2 leading-relaxed">Clear filters to restore the fixture data.</p>
                    <button onClick={() => setFilters(blank)} className="mt-5 text-xs font-bold uppercase tracking-wider bg-stone-100 px-4 py-2 rounded-lg hover:bg-stone-200 text-stone-700 transition-colors">Clear Filters</button>
                  </div>
                ) : (
                  results.map(r => (
                    <button 
                      key={r.id} 
                      onClick={() => setSelected(r)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${selected.id === r.id ? 'bg-white border-[#F5C518] shadow-[0_0_0_1px_#F5C518]' : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm flex items-center gap-1.5 ${
                          r.status === 'Published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.status === 'Published' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {r.status === 'Published' ? 'Verified Preview' : r.status}
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono font-medium">{r.date}</span>
                      </div>
                      <h3 className={`font-serif font-bold text-base mb-2 leading-tight ${selected.id === r.id ? 'text-black' : 'text-stone-800'}`}>{r.title}</h3>
                      <div className="text-xs text-stone-500 truncate flex items-center gap-2 mb-1">
                        <BookMarked className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                        {r.citation || NOT_STATED}
                      </div>
                      <div className="text-xs text-stone-500 truncate flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                        {r.court}
                      </div>
                    </button>
                  ))
                )}
              </div>
           </div>
           
           {/* Reader */}
           <div className="flex-1 bg-stone-100 h-auto md:h-full md:overflow-y-auto scrollbar-thin p-4 md:p-6 lg:p-8">
             <Reader r={selected} />
           </div>
        </div>
      ) : view === 'centre' ? (
        <PracticeCentre jurisdiction={jurisdiction} />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-stone-50 p-6 md:p-10 lg:p-16 print:block">
          <div className="max-w-5xl mx-auto space-y-10">
            <header className="mb-10 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-200 text-stone-700 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
                <Layout className="w-3.5 h-3.5" /> Workspace Tool
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-stone-900 tracking-tight">Matter Studio</h1>
              <p className="text-stone-600 mt-4 text-lg max-w-2xl">Drafting, workflows, and filing readiness for local Sarawak matters.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
              <section className="bg-white p-6 md:p-8 border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
                  <div className="w-10 h-10 rounded-full bg-[#F5C518]/10 flex items-center justify-center shrink-0">
                    <Briefcase className="w-5 h-5 text-[#D4A000]" />
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Matter Workspace</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Sample Matter</label>
                    <select value={matter} onChange={e=>setMatter(e.target.value)} className="w-full border border-stone-300 rounded-lg p-3 bg-stone-50 focus:ring-2 focus:ring-[#F5C518] focus:border-[#F5C518] outline-none transition-all text-sm font-medium">
                      <option>SFI access research</option>
                      <option>Tuaran criminal trial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Client Instructions</label>
                    <textarea value={instruction} onChange={e=>setInstruction(e.target.value)} className="w-full border border-stone-300 rounded-lg p-3 bg-stone-50 focus:ring-2 focus:ring-[#F5C518] focus:border-[#F5C518] outline-none transition-all text-sm min-h-[120px] resize-y" />
                  </div>
                  <div className="bg-stone-100 p-4 rounded-lg border border-stone-200 text-sm text-stone-700 flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-stone-900 mb-0.5">Local Session Binding</strong>
                      Currently bound to <span className="font-medium text-[#D4A000]">{matter}</span>. All actions will be logged to this matter.
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 md:p-8 border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
                  <div className="w-10 h-10 rounded-full bg-[#F5C518]/10 flex items-center justify-center shrink-0">
                    <FileSignature className="w-5 h-5 text-[#D4A000]" />
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Practical Document Studio</h2>
                </div>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Cause-paper Type</label>
                    <select value={doc} onChange={e=>setDoc(e.target.value)} className="w-full border border-stone-300 rounded-lg p-3 bg-stone-50 focus:ring-2 focus:ring-[#F5C518] focus:border-[#F5C518] outline-none transition-all text-sm font-medium">
                      <option>Affidavit</option>
                      <option>Written submission</option>
                      <option>Notice of application</option>
                    </select>
                  </div>
                  <button onClick={()=>setInstruction(`LOCAL PREVIEW DRAFT — ${doc}\n\nMatter Context: ${matter}\nInstructions:\n${instruction}`)} className="w-full bg-[#0A1118] hover:bg-black text-[#F5C518] font-bold py-3.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Layers className="w-5 h-5" /> Generate Deterministic Draft
                  </button>
                  
                  <div className="relative">
                    <div className="absolute -top-3 left-3 bg-stone-900 text-stone-400 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">Preview Output</div>
                    <pre className="mt-2 bg-stone-900 text-stone-300 p-5 pt-6 rounded-xl text-xs overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed border border-stone-800 shadow-inner">
                      {instruction}
                    </pre>
                  </div>
                </div>
              </section>

              <section className="bg-white p-6 md:p-8 border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow lg:col-span-2">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
                  <div className="w-10 h-10 rounded-full bg-[#F5C518]/10 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-5 h-5 text-[#D4A000]" />
                  </div>
                  <h2 className="text-xl font-bold text-stone-900">Filing Readiness Checklist</h2>
                </div>
                
                <div className="flex flex-col md:flex-row gap-8 lg:gap-12 items-start md:items-center">
                  <div className="flex-1 space-y-4 w-full">
                    {["Authority access checked locally","Citation verified against official registry","Human substantive review completed"].map((x,i)=>(
                      <label key={x} className="flex items-center gap-4 cursor-pointer group p-3 rounded-xl hover:bg-stone-50 transition-colors border border-transparent hover:border-stone-200">
                        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${checks[i] ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' : 'border-stone-300 group-hover:border-stone-400 bg-white'}`}>
                          {checks[i] && <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                        <input type="checkbox" className="sr-only" checked={checks[i]} onChange={()=>setChecks(checks.map((v,n)=>n===i?!v:v))}/>
                        <span className={`text-base font-medium transition-colors ${checks[i] ? 'text-stone-900' : 'text-stone-600 group-hover:text-stone-800'}`}>{x}</span>
                      </label>
                    ))}
                  </div>
                  
                  <div className={`w-full md:w-[380px] p-6 rounded-xl border-2 shrink-0 transition-colors ${checks.every(Boolean) ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start gap-4">
                      {checks.every(Boolean) ? <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" /> : <AlertCircle className="w-8 h-8 text-amber-600 shrink-0" />}
                      <div>
                        <p className={`text-lg font-bold mb-1 ${checks.every(Boolean) ? 'text-emerald-800' : 'text-amber-800'}`}>
                          {checks.every(Boolean) ? "Ready for local checklist review" : "Checks outstanding"}
                        </p>
                        <p className={`text-sm leading-relaxed ${checks.every(Boolean) ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {checks.every(Boolean) ? "All prerequisite verification steps have been completed. You may proceed to finalize the matter filing." : "You must complete all manual verification steps before this document can be considered filing-ready."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}