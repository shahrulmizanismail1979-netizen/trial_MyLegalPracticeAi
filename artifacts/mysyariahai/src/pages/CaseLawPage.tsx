/**
 * Case Law Search & Viewer — MySyariahAI
 * Fetches from /api/cases (portal subscriber auth via sya.sid cookie).
 */
import React, { useState, useCallback, useEffect } from "react";
import { Search, ArrowLeft, Copy, BookOpen, Loader2, ChevronRight, ChevronLeft, FolderKanban, Check } from "lucide-react";

const FETCH_INIT: RequestInit = { credentials: "include" };
const SYA_MATTERS_API = "/api/sya/matters";
const MATTERS_URL = SYA_MATTERS_API;

interface Headnote { number: number; text: string; paragraphRef: string | null }
interface Catchword { sortOrder: number; catchwordLine: string }
interface SearchResult {
  id: number; citation: string | null; caseName: string | null;
  court: string | null; decisionDate: string | null; parties: string | null;
  headnotes: Headnote[]; catchwords: Catchword[]; snippet: string | null;
}
interface CaseDetail extends SearchResult {
  coram: string | null; advocates: string | null;
  paragraphs: Array<{ paragraphRef: string; pageNumber: number; text: string }>;
}
interface Matter { id: number; title: string }

function fmt(d: string | null) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString("en-MY", { year: "numeric", month: "long", day: "numeric" }); } catch { return d; }
}

export default function CaseLawPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [court, setCourt] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [showMatter, setShowMatter] = useState(false);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [mattersLoading, setMattersLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const doSearch = useCallback(async (q: string, ct: string, df: string, dt: string, off: number) => {
    setLoading(true); setErr("");
    try {
      const p = new URLSearchParams();
      if (q) p.set("q", q); if (ct) p.set("court", ct);
      if (df) p.set("dateFrom", df); if (dt) p.set("dateTo", dt);
      p.set("limit", String(LIMIT)); p.set("offset", String(off));
      const r = await fetch(`/api/cases/search?${p}`, FETCH_INIT);
      if (!r.ok) throw new Error(r.status === 401 ? "Sign in to access case law." : "Search failed.");
      const d = await r.json();
      setResults(d.results ?? []); setTotal(d.total ?? 0);
    } catch (e) { setErr(e instanceof Error ? e.message : "Search failed"); setResults([]); setTotal(0); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { doSearch("", "", "", "", 0); }, [doSearch]);
  const handleSearch = () => { setOffset(0); setSelectedId(null); setDetail(null); setSubmitted(query); doSearch(query, court, dateFrom, dateTo, 0); };
  const handlePage = (o: number) => { setOffset(o); doSearch(submitted, court, dateFrom, dateTo, o); };

  const openCase = useCallback(async (id: number) => {
    setSelectedId(id); setDetail(null); setDetailLoading(true); setShowMatter(false);
    try { const r = await fetch(`/api/cases/${id}`, FETCH_INIT); if (!r.ok) throw new Error(""); setDetail(await r.json()); }
    catch { setDetail(null); } finally { setDetailLoading(false); }
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(detail?.citation ?? detail?.caseName ?? "").then(() => {
      setToast("Citation copied!"); setTimeout(() => setToast(""), 2500);
    });
  };

  const copyHeadnote = (h: Headnote) => {
    const citationRef = detail?.citation ?? detail?.caseName ?? "";
    const parts = [citationRef, `headnote ${h.number}`];
    if (h.paragraphRef) parts.push(h.paragraphRef);
    const text = `${h.text} (${parts.join(", ")})`;
    navigator.clipboard.writeText(text).then(() => {
      setToast(`Headnote ${h.number} copied!`); setTimeout(() => setToast(""), 2500);
    });
  };

  const loadMatters = useCallback(async () => {
    setMattersLoading(true);
    try {
      const r = await fetch(MATTERS_URL, FETCH_INIT); const d = await r.json();
      setMatters((Array.isArray(d) ? d : d.matters ?? d.items ?? []).slice(0, 60));
    } catch { setMatters([]); } finally { setMattersLoading(false); }
  }, []);

  const saveToMatter = async (matterId: number) => {
    if (!detail) return; setSaving(matterId);
    try {
      const saveR = await fetch(`${SYA_MATTERS_API}/${matterId}/work`, { ...FETCH_INIT, method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "case_law", title: detail.citation ?? detail.caseName ?? `Case #${detail.id}`,
          content: JSON.stringify({ citation: detail.citation, caseName: detail.caseName, court: detail.court, decisionDate: detail.decisionDate, headnotes: detail.headnotes, catchwords: detail.catchwords }) }) });
      if (!saveR.ok) throw new Error(`Save failed: ${saveR.status}`);
      setToast("Saved to matter file!"); setShowMatter(false); setTimeout(() => setToast(""), 3000);
    } catch { setToast("Save failed."); setTimeout(() => setToast(""), 2500); }
    finally { setSaving(null); }
  };

  if (selectedId !== null) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button onClick={() => { setSelectedId(null); setDetail(null); setShowMatter(false); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to search results
          </button>
          {detailLoading && <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {detail && (
            <div className="space-y-8">
              <div className="border border-border rounded-lg p-6 bg-card space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    {detail.citation && <p className="font-mono text-sm text-primary font-semibold">{detail.citation}</p>}
                    <h1 className="font-serif text-xl font-bold mt-1">{detail.caseName ?? "Untitled Case"}</h1>
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    <button onClick={copy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors"><Copy className="h-3.5 w-3.5" /> Copy Citation</button>
                    <div className="relative">
                      <button onClick={() => { if (!showMatter) loadMatters(); setShowMatter(!showMatter); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                        <FolderKanban className="h-3.5 w-3.5" /> Save to Matter
                      </button>
                      {showMatter && (
                        <div className="absolute right-0 top-9 z-50 w-72 bg-card border border-border rounded-lg shadow-xl p-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Select Matter</p>
                          {mattersLoading ? <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div> :
                           matters.length === 0 ? <p className="text-sm text-muted-foreground py-2">No matters found.</p> :
                           <div className="max-h-56 overflow-y-auto space-y-1">{matters.map(m => (
                             <button key={m.id} onClick={() => saveToMatter(m.id)} disabled={saving === m.id}
                               className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted flex items-center gap-2">
                               {saving === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />}
                               <span className="flex-1 truncate">{m.title ?? `Matter #${m.id}`}</span>
                             </button>
                           ))}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                  {detail.court && <span>{detail.court}</span>}{detail.decisionDate && <span>· {fmt(detail.decisionDate)}</span>}
                </div>
              </div>
              {detail.catchwords.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><span className="h-px flex-1 bg-border" /> CATCHWORDS <span className="h-px flex-1 bg-border" /></h2>
                  <div className="bg-muted/30 border border-border rounded-lg px-6 py-4 font-serif text-sm leading-relaxed space-y-1">{detail.catchwords.map((c, i) => <p key={i}>{c.catchwordLine}</p>)}</div>
                </section>
              )}
              {detail.headnotes.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><span className="h-px flex-1 bg-border" /> HEADNOTES <span className="h-px flex-1 bg-border" /></h2>
                  <div className="space-y-4">{detail.headnotes.map(h => (
                    <div key={h.number} className="group flex gap-4 border-l-2 border-primary/30 pl-4 py-1">
                      <span className="text-primary font-bold font-mono text-sm shrink-0 w-5 mt-0.5">{h.number}.</span>
                      <p className="text-sm leading-relaxed font-serif flex-1">{h.text}</p>
                      <button
                        onClick={() => copyHeadnote(h)}
                        title={`Copy headnote ${h.number} citation`}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-opacity focus:outline-none focus:ring-2 focus:ring-primary/50"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}</div>
                </section>
              )}
              {detail.paragraphs.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2"><span className="h-px flex-1 bg-border" /> JUDGMENT <span className="h-px flex-1 bg-border" /></h2>
                  <div className="space-y-3">{detail.paragraphs.map((p, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className="text-muted-foreground font-mono text-xs shrink-0 mt-1 w-12 text-right">{p.paragraphRef}</span>
                      <p className="leading-relaxed font-serif flex-1">{p.text}</p>
                    </div>
                  ))}</div>
                </section>
              )}
            </div>
          )}
        </div>
        {toast && <div className="fixed bottom-6 right-6 bg-card border border-border rounded-lg px-4 py-3 shadow-xl text-sm flex items-center gap-2 z-50"><Check className="h-4 w-4 text-primary" />{toast}</div>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg"><BookOpen className="h-5 w-5 text-primary" /></div>
            <h1 className="font-serif text-2xl font-bold">Case Law Search</h1>
          </div>
          <p className="text-sm text-muted-foreground">Search Malaysian case law with law reporter headnotes and catchwords.</p>
        </div>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search by keyword, citation, case name…"
              className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground" />
          </div>
          <button onClick={handleSearch} disabled={loading}
            className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          <input value={court} onChange={e => setCourt(e.target.value)} placeholder="Filter by court…"
            className="px-3 py-2 bg-card border border-border rounded-md text-sm focus:outline-none w-48 placeholder:text-muted-foreground" />
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setOffset(0); }}
              className="px-2 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setOffset(0); }}
              className="px-2 py-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          {(court || submitted || dateFrom || dateTo) && <button onClick={() => { setCourt(""); setQuery(""); setSubmitted(""); setDateFrom(""); setDateTo(""); setOffset(0); doSearch("", "", "", "", 0); }}
            className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted">Clear</button>}
        </div>
        {err && <div className="mb-4 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">{err}</div>}
        {!loading && total > 0 && <p className="text-xs text-muted-foreground mb-4">{submitted ? `${total} result${total !== 1 ? "s" : ""} for "${submitted}"` : `${total} case${total !== 1 ? "s" : ""} available`}</p>}
        {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 bg-muted/40 rounded-lg animate-pulse" />)}</div>}
        {!loading && results.length > 0 && (
          <div className="space-y-3">{results.map(r => (
            <button key={r.id} onClick={() => openCase(r.id)}
              className="w-full text-left bg-card border border-border rounded-lg p-5 hover:border-primary/40 hover:shadow-sm transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {r.citation && <p className="font-mono text-xs text-primary font-semibold mb-1">{r.citation}</p>}
                  <h3 className="font-serif font-semibold text-base leading-snug mb-2 group-hover:text-primary transition-colors">{r.caseName ?? "Untitled Case"}</h3>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mb-2">{r.court && <span>{r.court}</span>}{r.decisionDate && <span>· {fmt(r.decisionDate)}</span>}</div>
                  {r.catchwords.length > 0 && <p className="text-xs text-muted-foreground font-serif line-clamp-2">{r.catchwords.map(c => c.catchwordLine).join(" · ")}</p>}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-primary" />
              </div>
            </button>
          ))}</div>
        )}
        {!loading && results.length === 0 && !err && (
          <div className="text-center py-16"><BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{submitted ? `No cases found for "${submitted}".` : "No approved cases available yet."}</p>
          </div>
        )}
        {!loading && total > LIMIT && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
            <button onClick={() => handlePage(Math.max(0, offset - LIMIT))} disabled={offset === 0}
              className="flex items-center gap-1 px-4 py-2 text-sm border border-border rounded-md disabled:opacity-40 hover:bg-muted"><ChevronLeft className="h-4 w-4" /> Previous</button>
            <span className="text-xs text-muted-foreground">{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
            <button onClick={() => handlePage(offset + LIMIT)} disabled={offset + LIMIT >= total}
              className="flex items-center gap-1 px-4 py-2 text-sm border border-border rounded-md disabled:opacity-40 hover:bg-muted">Next <ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
