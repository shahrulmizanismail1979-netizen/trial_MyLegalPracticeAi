import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, ArrowUpRight, Check, RotateCcw, X, Plus, FileText } from "lucide-react";
import {
  REPORTS,
  GUIDED_SEARCH_TAXONOMY,
  filterReports,
  NOT_STATED,
  exportRecords
} from "@/fixtures/lawyes-preview";
import { SourceBadge, Provenance, ReportReader, download } from "./shared";
import type { RouterState } from "./use-router-state";

export function SearchView({ state, updateState }: { state: RouterState; updateState: (updates: Partial<RouterState>, replace?: boolean) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [exportFeedback, setExportFeedback] = useState("");

  const activeFilters = {
    q: state.q,
    jurisdiction: state.jurisdiction,
    court: state.court,
    practiceArea: state.practiceArea,
    status: state.status,
  };

  const results = useMemo(() => {
    let filtered = filterReports(REPORTS, activeFilters);
    const sort = state.sort || "title";
    return filtered.sort((left, right) => {
      if (sort === "date") return right.isoDate.localeCompare(left.isoDate);
      if (sort === "court") return left.court.localeCompare(right.court);
      if (sort === "status") return left.status.localeCompare(right.status);
      if (sort === "sarawak") return Number(right.jurisdiction === "Sarawak") - Number(left.jurisdiction === "Sarawak") || left.title.localeCompare(right.title);
      return left.title.localeCompare(right.title);
    });
  }, [activeFilters, state.sort]);
  
  const hasFilters = state.q || state.court || state.practiceArea || state.status || state.jurisdiction;

  const handleReset = () => {
    updateState({ q: "", jurisdiction: "", court: "", practiceArea: "", status: "", sort: "title", reportId: "" }, true);
  };

  const selectedReport = REPORTS.find(r => r.id === state.reportId) || null;

  const exportJSON = () => {
    try {
      const data = JSON.stringify(exportRecords(results), null, 2);
      download("lawyes-search-results.json", data, "application/json");
      setExportFeedback("Exported JSON successfully");
    } catch {
      setExportFeedback("Failed to export JSON");
    }
    setTimeout(() => setExportFeedback(""), 3000);
  };

  const handleToggleMaterial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = state.selectedMaterials ? state.selectedMaterials.split(",") : [];
    const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    updateState({ selectedMaterials: updated.join(",") }, true);
  };

  const selectedMaterialsArray = state.selectedMaterials ? state.selectedMaterials.split(",") : [];

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
      {/* Search Header & Filters */}
      <div className="bg-white border-b border-border z-20 shrink-0">
        <div className="px-5 py-4 max-w-7xl mx-auto">
          <form className="flex flex-wrap md:flex-nowrap gap-3 items-center" onSubmit={e => e.preventDefault()}>
            <div className="relative flex-1 min-w-[280px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={state.q}
                onChange={(e) => updateState({ q: e.target.value }, true)}
                placeholder="Search judgments, principles, or legislation..."
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center min-w-max">
              <select
                aria-label="Jurisdiction"
                value={state.jurisdiction}
                onChange={(e) => updateState({ jurisdiction: e.target.value as any }, true)}
                className="py-2.5 pl-3 pr-8 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium"
              >
                {GUIDED_SEARCH_TAXONOMY.jurisdictions.map(j => (
                  <option key={j.id} value={j.id}>{j.label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={`p-2.5 border rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${showAdvanced ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-background border-border text-foreground hover:bg-muted'}`}
              >
                <SlidersHorizontal size={16} />
                <span className="hidden sm:inline">Filters</span>
                {hasFilters && !showAdvanced && <span className="w-2 h-2 rounded-full bg-primary ml-1" />}
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Guided searches">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">Try</span>
            <button
              type="button"
              onClick={() => updateState({ q: "", jurisdiction: "", status: "Lawyer reviewed", reportId: "" }, true)}
              aria-pressed={state.status === "Lawyer reviewed" && !state.q && !state.jurisdiction}
              className={`min-h-9 px-3 rounded-full border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                state.status === "Lawyer reviewed" && !state.q && !state.jurisdiction
                  ? "border-primary bg-primary text-white"
                  : "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              }`}
            >
              Published reports ({REPORTS.filter((report) => report.status === "Published").length})
            </button>
            {GUIDED_SEARCH_TAXONOMY.exampleQueries.slice(0, 4).map((query) => (
              <button
                key={query}
                type="button"
                onClick={() => updateState({ q: query, reportId: "" }, true)}
                className="min-h-9 px-3 rounded-full border border-border bg-background text-xs text-foreground/80 hover:border-primary/30 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {query}
              </button>
            ))}
          </div>

          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-border animate-in slide-in-from-top-2 duration-200">
              <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label htmlFor="lawyes-court-filter" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Court</label>
                  <select
                    id="lawyes-court-filter"
                    value={state.court}
                    onChange={(e) => updateState({ court: e.target.value }, true)}
                    className="w-full py-2 px-3 bg-background border border-border rounded-md text-sm"
                  >
                    <option value="">All Courts</option>
                    {GUIDED_SEARCH_TAXONOMY.courts.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="lawyes-practice-area-filter" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Practice Area</label>
                  <select
                    id="lawyes-practice-area-filter"
                    value={state.practiceArea}
                    onChange={(e) => updateState({ practiceArea: e.target.value }, true)}
                    className="w-full py-2 px-3 bg-background border border-border rounded-md text-sm"
                  >
                    <option value="">All Areas</option>
                    {GUIDED_SEARCH_TAXONOMY.subjectAreas.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="lawyes-editorial-status-filter" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Editorial Status</label>
                  <select
                    id="lawyes-editorial-status-filter"
                    value={state.status}
                    onChange={(e) => updateState({ status: e.target.value }, true)}
                    className="w-full py-2 px-3 bg-background border border-border rounded-md text-sm"
                  >
                    <option value="">All Statuses</option>
                    {GUIDED_SEARCH_TAXONOMY.verificationStatuses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="lawyes-sort-filter" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Sort By</label>
                  <select 
                    id="lawyes-sort-filter"
                    value={state.sort || "title"}
                    onChange={(e) => updateState({ sort: e.target.value }, true)}
                    className="w-full py-2 px-3 bg-background border border-border rounded-md text-sm"
                  >
                    <option value="title">Title (A-Z)</option>
                    <option value="date">Date (Newest first)</option>
                    <option value="court">Court (A-Z)</option>
                    <option value="status">Status (A-Z)</option>
                    <option value="sarawak">Regional focus (Sarawak first)</option>
                  </select>
                </div>
                <div className="flex items-end pb-0.5">
                  <button onClick={handleReset} className="w-full py-2 px-3 bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                    <RotateCcw size={14} /> Reset
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden bg-background">

        {/* Results List */}
        <div className={`flex-1 overflow-y-auto border-r border-border transition-all duration-300 ${selectedReport ? 'hidden md:block md:max-w-xs lg:max-w-sm xl:max-w-md' : 'w-full'}`}>
          <div className="p-4 flex items-center justify-between border-b border-border bg-white sticky top-0 z-10">
            <h2 className="text-sm font-bold text-foreground">
              {results.length} {results.length === 1 ? 'Result' : 'Results'}
            </h2>
            <div className="flex items-center gap-2">
              <span aria-live="polite" className="text-xs text-secondary font-medium">{exportFeedback}</span>
              <button onClick={exportJSON} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
                Export JSON
              </button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {results.length > 0 ? results.map((report) => {
              const isSelected = state.reportId === report.id;
              const isMaterialSelected = selectedMaterialsArray.includes(report.id);
              return (
                <div
                  key={report.id}
                  className={`w-full text-left p-5 transition-colors focus-within:bg-muted/50 ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/30 border-l-4 border-l-transparent'}`}
                >
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <button
                      onClick={() => updateState({ reportId: report.id })}
                      className="text-base font-serif text-foreground font-medium leading-snug line-clamp-2 text-left hover:text-primary focus:outline-none focus:underline"
                    >
                      {report.title}
                    </button>
                    <div className="shrink-0 flex gap-2">
                      <button
                        onClick={(e) => handleToggleMaterial(report.id, e)}
                        title={isMaterialSelected ? "Remove from matter" : "Add to matter"}
                        aria-label={isMaterialSelected ? `Remove ${report.title} from matter` : `Add ${report.title} to matter`}
                        className={`p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border transition-colors ${isMaterialSelected ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:border-primary/50 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary/50'}`}
                      >
                        {isMaterialSelected ? <Check size={18} /> : <Plus size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mb-3">
                    <span className="font-mono text-foreground/80">{report.citation || NOT_STATED}</span>
                    <span>&middot;</span>
                    <span>{report.date}</span>
                    <span>&middot;</span>
                    <span className="truncate max-w-[150px]">{report.court}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <SourceBadge status={report.editorialStatus} />
                    {report.jurisdiction === "Sarawak" && <span className="inline-flex px-1.5 py-0.5 border border-secondary/20 bg-secondary/5 text-secondary text-[10px] font-bold uppercase tracking-wider">Swk</span>}
                    {report.practiceAreas.slice(0, 1).map(pa => (
                      <span key={pa} className="inline-flex px-1.5 py-0.5 border border-border bg-white text-muted-foreground text-[10px] font-bold uppercase tracking-wider">{pa}</span>
                    ))}
                  </div>
                </div>
              );
            }) : (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
                  <Search size={24} />
                </div>
                <h3 className="text-lg font-serif mb-2">No results found</h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">We couldn't find any materials matching your current filters and jurisdiction.</p>
                <button onClick={handleReset} className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-colors">
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Reader Pane */}
        {(selectedReport || !results.length) && (
          <div className={`flex-[2] overflow-hidden relative bg-muted/10 ${!selectedReport && 'hidden md:block'}`}>
            {selectedReport ? (
              <div className="h-full overflow-y-auto">
                <ReportReader report={selectedReport} onClose={() => updateState({ reportId: "" })} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
                <FileText size={48} className="opacity-20 mb-4" />
                <p className="font-medium text-foreground/60">Select a report or record to read</p>
                <p className="text-sm text-center max-w-xs mt-2 opacity-70">The reader pane provides verified paragraph anchors, editorial history, and source provenance.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}