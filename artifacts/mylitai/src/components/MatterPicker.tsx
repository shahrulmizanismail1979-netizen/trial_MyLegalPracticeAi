/**
 * MatterPicker — "Load from case file" compact button/popover.
 *
 * Renders a small button that opens a popover listing the lawyer's matters.
 * On selection it fires onSelect(matter) so the parent can map fields.
 *
 * Usage:
 *   <MatterPicker onSelect={(m) => { setField('parties', `${m.plaintiff} v ${m.defendant}`); }} />
 */
import { useEffect, useRef, useState } from 'react';
import { FolderOpen, Search, ChevronDown, X } from 'lucide-react';
import { useMatters, type Matter } from '@/hooks/use-matters';

interface MatterPickerProps {
  onSelect: (matter: Matter) => void;
  /** Optional label override. Default: "Load from case file" */
  label?: string;
  /** Pre-select this matter once the list loads and fire onSelect. */
  defaultMatterId?: number | null;
}

/** Build a compact formatted summary of a matter's key fields. */
export function buildMatterSummary(m: Matter): string {
  const parts: string[] = [];
  if (m.title) parts.push(`Matter: ${m.title}`);
  if (m.clientName) parts.push(`Client: ${m.clientName}`);
  if (m.actingFor) parts.push(`Acting for: ${m.actingFor}`);
  if (m.plaintiff) parts.push(`Plaintiff: ${m.plaintiff}`);
  if (m.defendant) parts.push(`Defendant: ${m.defendant}`);
  if (m.court) parts.push(`Court: ${m.court}`);
  if (m.suitNo) parts.push(`Suit No: ${m.suitNo}`);
  if (m.claimAmount) parts.push(`Claim: RM${m.claimAmount}`);
  if (m.matterType) parts.push(`Type: ${m.matterType}`);
  return parts.join(' | ');
}

export function MatterPicker({ onSelect, label = 'Load from case file', defaultMatterId }: MatterPickerProps) {
  const { data: matters, isLoading } = useMatters();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const defaultFired = useRef(false);

  useEffect(() => {
    if (defaultFired.current || defaultMatterId == null || !matters?.length) return;
    const matter = matters.find((candidate) => candidate.id === defaultMatterId);
    if (!matter) return;
    defaultFired.current = true;
    onSelect(matter);
  // Fire only once when the requested matter becomes available.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultMatterId, matters]);

  const filtered = (matters ?? []).filter((m) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.clientName ?? '').toLowerCase().includes(q) ||
      (m.suitNo ?? '').toLowerCase().includes(q)
    );
  });

  const pick = (m: Matter) => {
    onSelect(m);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium"
      >
        <FolderOpen className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setQuery(''); }} />

          {/* Popover */}
          <div className="absolute left-0 top-full mt-1 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl shadow-black/30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Search */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, client or suit no…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-64 overflow-y-auto">
              {isLoading && (
                <p className="px-4 py-3 text-sm text-muted-foreground">Loading matters…</p>
              )}
              {!isLoading && filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  {(matters ?? []).length === 0
                    ? 'No matters found. Create one under Matters first.'
                    : 'No matches — try a different search.'}
                </p>
              )}
              {filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => pick(m)}
                  className="w-full text-left px-4 py-2.5 hover:bg-secondary transition-colors border-b border-border/50 last:border-0"
                >
                  <p className="text-sm font-medium text-foreground leading-snug truncate">{m.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {[m.clientName, m.suitNo].filter(Boolean).join(' · ') || 'No client / suit number'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
