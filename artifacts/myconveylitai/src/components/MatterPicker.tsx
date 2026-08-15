import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, X, ChevronDown } from 'lucide-react';
import { useMatters, type Matter } from '@/lib/matters';

interface MatterPickerProps {
  onSelect: (matter: Matter) => void;
  selectedMatter: Matter | null;
  onClear: () => void;
}

export function MatterPicker({ onSelect, selectedMatter, onClear }: MatterPickerProps) {
  const { data: matters, isLoading } = useMatters();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selectedMatter) {
    return (
      <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
        <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-amber-300 truncate block">
            Loaded: {selectedMatter.title}
          </span>
          <span className="text-[10px] text-slate-400 truncate block">
            {[selectedMatter.clientName, selectedMatter.reference].filter(Boolean).join(' · ')}
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="p-0.5 text-slate-400 hover:text-white transition-colors shrink-0"
          title="Clear loaded matter"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 bg-gold-800 hover:bg-gold-700 border border-gold-700 hover:border-amber-500/40 rounded-xl px-3 py-2 text-xs text-slate-300 transition-colors"
      >
        <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="flex-1 text-left">Load from case file…</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gold-900 border border-gold-700 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="px-4 py-3 text-xs text-slate-400">Loading matters…</div>
          )}
          {!isLoading && (!matters || matters.length === 0) && (
            <div className="px-4 py-3 text-xs text-slate-400">No case files found.</div>
          )}
          {!isLoading && matters && matters.length > 0 && matters.map(m => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-gold-800 transition-colors border-b border-gold-800 last:border-b-0"
              onClick={() => {
                onSelect(m);
                setOpen(false);
              }}
            >
              <div className="text-xs font-semibold text-slate-100 truncate">{m.title}</div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {[
                  m.clientName,
                  m.matterType,
                  m.reference,
                ].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
