import React, { useState, useRef, useEffect } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import {
  FileSearch,
  Scale,
  Clock3,
  ChevronDown,
  Send,
  Loader2,
  Copy,
  Check,
  RotateCcw,
  AlertTriangle,
  Info,
  Briefcase,
  BookOpen,
  ClipboardCheck,
  ScrollText,
  Swords,
  FileSignature,
  Coins,
  Library,
  CheckSquare,
  BookmarkPlus,
  Calculator,
  Handshake,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { FileUploadDropzone, buildContextFromFiles, type ExtractedFile } from '@/components/FileUploadDropzone';
import { ExportButtons } from '@/components/ExportButtons';
import { DraftDocument } from '@workspace/draft-export/react';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useToast } from '@/hooks/use-toast';
import { usePersistentState } from '@/hooks/use-persistent-state';

// Map a tool's export title prefix to a saved-work kind
function deriveKind(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith('skeleton')) return 'brief';
  if (t.startsWith('document analysis')) return 'analysis';
  if (t.startsWith('limitation')) return 'limitation';
  if (t.startsWith('case law research')) return 'research';
  if (t.startsWith('pleading')) return 'pleading';
  if (t.startsWith('legal opinion')) return 'opinion';
  if (t.startsWith('cross-exam')) return 'crossexam';
  if (t.startsWith('affidavit')) return 'affidavit';
  if (t.startsWith('quantum')) return 'quantum';
  if (t.startsWith('bundle')) return 'bundle';
  if (t.startsWith('hearing')) return 'hearing';
  if (t.startsWith('costs estimate')) return 'costs';
  if (t.startsWith('settlement')) return 'settlement';
  if (t.startsWith('cause of action')) return 'causeofaction';
  return 'note';
}

// Save-to-My-Work button shared by all Chambers tools
function SaveToWorkButton({ title, content }: { title: string; content: string }) {
  const saveWork = useSaveWork();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const matter = title.includes(' — ') ? title.split(' — ').slice(1).join(' — ').trim() : '';
    try {
      await saveWork.mutateAsync({ kind: deriveKind(title), title, matter: matter || null, content });
      setSaved(true);
      toast({ title: 'Draft saved', description: 'Find it under Saved Drafts on the Matters page.' });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSave}
      disabled={saveWork.isPending || !content}
      className="h-7 gap-1.5 text-xs"
    >
      {saved ? <><Check className="h-3.5 w-3.5" />Saved</> : <><BookmarkPlus className="h-3.5 w-3.5" />Save Draft</>}
    </Button>
  );
}

// ─── SSE streaming utility ────────────────────────────────────────────────────
async function streamFromEndpoint(
  endpoint: string,
  body: Record<string, string>,
  onChunk: (text: string) => void,
  onDone: (disclaimer?: string) => void,
  onError: (msg: string) => void
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) emitRateLimit(0);
    throw new Error(
      response.status === 429
        ? 'Too many AI requests. Please try again shortly.'
        : 'Server error'
    );
  }

  const rl = readRateLimitRemaining(response);
  if (rl !== null) emitRateLimit(rl);

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error('No stream');

  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) { onError(data.error); return; }
        if (data.done) { onDone(data.disclaimer); return; }
        if (data.content) onChunk(data.content);
      } catch {}
    }
  }
}

// ─── Markdown-aware output renderer ──────────────────────────────────────────
function LegalOutput({ text, disclaimer, exportTitle }: { text: string; disclaimer?: string; exportTitle?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = text.split('\n');
  const rendered = lines.map((line, i) => {
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length ?? 1;
      const content = line.replace(/^#+\s*/, '');
      const cls = level === 1 ? 'text-lg font-serif font-bold text-primary mt-6 mb-2' :
                   level === 2 ? 'text-base font-bold text-primary mt-5 mb-1' :
                   'text-sm font-bold text-foreground mt-4 mb-1 uppercase tracking-wide';
      return <div key={i} className={cls}>{renderInline(content)}</div>;
    }
    if (/^\*\*\*/.test(line) || /^---/.test(line)) {
      return <hr key={i} className="border-border my-3" />;
    }
    if (/^(\d+)\.\s/.test(line)) {
      return (
        <div key={i} className="flex gap-2 my-0.5 ml-2">
          <span className="text-primary font-bold shrink-0 text-sm">{line.match(/^(\d+)\./)?.[1]}.</span>
          <span className="text-sm text-foreground/90 leading-relaxed">{renderInline(line.replace(/^\d+\.\s*/, ''))}</span>
        </div>
      );
    }
    if (/^[-•]\s/.test(line)) {
      return (
        <div key={i} className="flex gap-2 my-0.5 ml-4">
          <span className="text-primary shrink-0 mt-1">•</span>
          <span className="text-sm text-foreground/90 leading-relaxed">{renderInline(line.replace(/^[-•]\s*/, ''))}</span>
        </div>
      );
    }
    if (line.trim() === '') return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-sm text-foreground/90 leading-relaxed my-0.5">
        {renderInline(line)}
      </p>
    );
  });
  void rendered;

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">AI Output</span>
        <div className="flex items-center gap-2 flex-wrap">
          {exportTitle && <SaveToWorkButton title={exportTitle} content={text} />}
          {exportTitle ? (
            <ExportButtons title={exportTitle} content={text} />
          ) : (
            <Button variant="ghost" size="sm" onClick={copy} className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-primary">
              {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
            </Button>
          )}
        </div>
      </div>
      <div className="bg-background/60 border border-border rounded-lg p-5 max-h-[60vh] overflow-y-auto space-y-0.5 font-mono text-[13px] leading-relaxed">
        <DraftDocument content={text} />
      </div>
      {disclaimer && (
        <div className="mt-3 flex gap-2 items-start p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-500/90 leading-relaxed">{disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[CRITICAL\]|\[MAJOR\]|\[MINOR\]|\[TACTICAL\])/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="bg-primary/10 text-primary px-1 rounded text-[11px]">{part.slice(1, -1)}</code>;
    if (part === '[CRITICAL]') return <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 ml-1">CRITICAL</span>;
    if (part === '[MAJOR]') return <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 ml-1">MAJOR</span>;
    if (part === '[MINOR]') return <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 ml-1">MINOR</span>;
    if (part === '[TACTICAL]') return <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 ml-1">TACTICAL</span>;
    return part;
  });
}

// ─── Shared form components ───────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">{children}</label>;
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder: string; rows?: number }) {
  return (
    <textarea
      className="w-full bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none font-sans leading-relaxed"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <select
        className="w-full appearance-none bg-background/60 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors pr-8"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
    </div>
  );
}

function RunButton({ onClick, loading, label = 'Generate', icon }: { onClick: () => void; loading: boolean; label?: string; icon?: React.ReactNode }) {
  return (
    <Button
      onClick={onClick}
      disabled={loading}
      className="w-full mt-4 bg-primary text-background hover:bg-primary/90 font-semibold gap-2"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (icon ?? <Send className="h-4 w-4" />)}
      {loading ? 'Generating…' : label}
    </Button>
  );
}

// ─── TOOL 1: AI Brief Writer ──────────────────────────────────────────────────
function BriefWriter() {
  const [caseType, setCaseType] = usePersistentState('brief.caseType', '');
  const [plaintiff, setPlaintiff] = usePersistentState('brief.plaintiff', '');
  const [defendant, setDefendant] = usePersistentState('brief.defendant', '');
  const [courtLevel, setCourtLevel] = usePersistentState('brief.courtLevel', 'High Court in Malaya');
  const [facts, setFacts] = usePersistentState('brief.facts', '');
  const [issues, setIssues] = usePersistentState('brief.issues', '');
  const [authorities, setAuthorities] = usePersistentState('brief.authorities', '');
  const [relief, setRelief] = usePersistentState('brief.relief', '');
  const [context, setContext] = usePersistentState('brief.context', '');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = usePersistentState('brief.output', '');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!caseType.trim() || !facts.trim() || !issues.trim()) {
      setError('Please complete at least: Case Type, Facts, and Issues.');
      return;
    }
    setError('');
    setOutput('');
    setDisclaimer('');
    setLoading(true);
    const enrichedContext = (context + buildContextFromFiles(uploadedFiles)).trim();
    try {
      await streamFromEndpoint(
        '/api/lit/ai/brief',
        { caseType, plaintiff, defendant, courtLevel, facts, issues, authorities, reliefSought: relief, additionalContext: enrichedContext },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch (e) {
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const courts = ['High Court in Malaya', 'Court of Appeal', 'Federal Court', 'Sessions Court', 'Magistrates Court'];
  const caseTypes = [
    'Loan Recovery (Summary Judgment)',
    'Foreclosure / Order for Sale (Order 83)',
    'Winding Up Petition',
    'Bankruptcy Petition',
    'Hire Purchase Repossession',
    'Guarantee Enforcement',
    'Injunction (Mareva / Interlocutory)',
    'Appeal — Civil',
    'Breach of Contract (General)',
    'Negligence / Professional Negligence',
    'Medical Negligence',
    'Defamation',
    'Land Dispute / Adverse Possession',
    'Specific Performance',
    'Unfair Dismissal (Industrial Court s.20)',
    'Constructive Dismissal',
    'Judicial Review (Order 53)',
    'Oppression (s.346 Companies Act 2016)',
    'Derivative Action (s.347 Companies Act 2016)',
    'Matrimonial Assets / Divorce',
    'Custody (Guardianship of Infants Act 1961)',
    'CIPAA Adjudication / Construction Dispute',
    'Intellectual Property Infringement',
    'Contentious Probate / Will Dispute',
    'Other (specify in facts)',
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/15 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Generate a structured skeleton argument or written submission in Malaysian court format. Provide the case details below and the AI will draft a professionally structured submission with legal arguments and Malaysian authorities.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Case Type / Nature of Claim</Label>
          <Select value={caseType || caseTypes[0]} onChange={setCaseType} options={caseTypes} />
        </div>
        <div>
          <Label>Court Level</Label>
          <Select value={courtLevel} onChange={setCourtLevel} options={courts} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Plaintiff / Applicant</Label>
          <TextInput value={plaintiff} onChange={setPlaintiff} placeholder="e.g. Malayan Banking Bhd" />
        </div>
        <div>
          <Label>Defendant / Respondent</Label>
          <TextInput value={defendant} onChange={setDefendant} placeholder="e.g. ABC Sdn Bhd" />
        </div>
      </div>

      <div>
        <Label>Summary of Material Facts</Label>
        <TextArea value={facts} onChange={setFacts} placeholder="Set out the material facts chronologically: dates of facility, amounts, default, notices served, etc." rows={5} />
      </div>

      <div>
        <Label>Issues for Determination</Label>
        <TextArea value={issues} onChange={setIssues} placeholder="List the legal issues to be argued, e.g.: (1) Whether the defendant is liable under the facility agreement; (2) Whether the guarantee is enforceable; (3) Quantum of damages" rows={3} />
      </div>

      <div>
        <Label>Legal Authorities to Rely On (optional)</Label>
        <TextArea value={authorities} onChange={setAuthorities} placeholder="List any specific cases or statutes you wish to rely on. Leave blank and the AI will identify applicable Malaysian authorities." rows={2} />
      </div>

      <div>
        <Label>Relief Sought</Label>
        <TextArea value={relief} onChange={setRelief} placeholder="e.g. Order for Sale at reserved price of RM850,000; costs on solicitor-client basis; interest at 8% p.a." rows={2} />
      </div>

      <div>
        <Label>Additional Context (optional)</Label>
        <TextInput value={context} onChange={setContext} placeholder="Any other context — e.g. opposing arguments, unusual facts, previous orders" />
      </div>

      <div>
        <Label>Supporting Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload pleadings, exhibits, contracts or judgments"
          hint="PDF, DOCX, TXT  •  up to 5 files, 100 MB each. The AI will read them and weave the facts into the skeleton argument."
        />
      </div>

      {error && (
        <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Generate Skeleton Argument" icon={<Scale className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>

      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Skeleton Argument — ${plaintiff || 'Plaintiff'} v ${defendant || 'Defendant'}`} />}
    </div>
  );
}

// ─── TOOL 2: AI Document Analyser ────────────────────────────────────────────
function DocumentAnalyser() {
  const [docText, setDocText] = usePersistentState('analysis.docText', '');
  const [docType, setDocType] = usePersistentState('analysis.docType', '');
  const [focus, setFocus] = usePersistentState('analysis.focus', 'Full comprehensive analysis');
  const [output, setOutput] = usePersistentState('analysis.output', '');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const docTypes = [
    'Facility / Loan Agreement',
    'Guarantee / Indemnity',
    'Debenture / Fixed & Floating Charge',
    'Statutory Charge (Form 16A / NLC)',
    'Hire Purchase Agreement',
    'Sale and Purchase Agreement (SPA)',
    'Tenancy / Lease Agreement',
    'Employment Contract',
    'Shareholders Agreement',
    'Construction Contract (PAM / CIDB / PWD)',
    'Affidavit',
    'Statement of Claim / Pleading',
    'Statutory Demand (s.466 Companies Act 2016)',
    'Winding Up Petition',
    'Originating Summons (Order for Sale)',
    'Consent Order / Settlement Agreement',
    'Power of Attorney',
    'Trust Deed',
    'Will / Testamentary Document',
    'Insurance / Takaful Policy',
    'Islamic Banking Facility (BBA / Musharakah / Murabahah)',
    'Other — please identify',
  ];

  const focusOptions = [
    'Full comprehensive analysis',
    'Enforceability and risks only',
    'Missing clauses and compliance',
    'Default and enforcement provisions',
    'Security and priority issues',
    'Islamic finance Shariah compliance',
    'Unfair terms / consumer protection',
  ];

  const run = async () => {
    if (!docText.trim() || docText.trim().length < 100) {
      setError('Please paste the document text (minimum 100 characters).');
      return;
    }
    setError('');
    setOutput('');
    setDisclaimer('');
    setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/analyse',
        { documentText: docText, documentType: docType, analysisFocus: focus },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch {
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); setDocText(''); };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/15 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Paste any legal document — facility agreement, charge, guarantee, affidavit, petition — and receive a structured practitioner-level analysis flagging legal issues, missing clauses, enforceability risks, and recommended actions.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Document Type</Label>
          <Select value={docType || docTypes[0]} onChange={setDocType} options={docTypes} />
        </div>
        <div>
          <Label>Analysis Focus</Label>
          <Select value={focus} onChange={setFocus} options={focusOptions} />
        </div>
      </div>

      <div>
        <Label>Upload Document</Label>
        <FileUploadDropzone
          onFilesExtracted={(files) => {
            const usable = files.filter(f => f.text && !f.error);
            if (usable.length > 0) {
              const merged = usable.map(f => `=== ${f.name} ===\n${f.text}`).join('\n\n');
              setDocText(merged);
            }
          }}
          label="Upload PDF, DOCX, or TXT — the text fills the box below"
          hint="Or paste the document text manually below. Up to 5 files, 100 MB each."
        />
      </div>

      <div>
        <Label>Document Text</Label>
        <textarea
          className="w-full bg-background/60 border border-border rounded-lg px-3 py-3 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none font-mono leading-relaxed"
          value={docText}
          onChange={e => setDocText(e.target.value)}
          placeholder="Paste the full text of the document here, or upload a file above…&#10;&#10;The AI will analyse it for legal issues, enforceability risks, missing clauses, and provide prioritised recommendations."
          rows={14}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">{docText.length.toLocaleString()} characters</span>
          {docText && <button className="text-xs text-muted-foreground hover:text-destructive transition-colors" onClick={() => setDocText('')}>Clear</button>}
        </div>
      </div>

      {error && (
        <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Analyse Document" icon={<FileSearch className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>

      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Document Analysis — ${docType || 'Legal Document'}`} />}
    </div>
  );
}

// ─── TOOL 3: Limitation Calculator ───────────────────────────────────────────
function LimitationCalculator() {
  const [causeOfAction, setCauseOfAction] = usePersistentState('limitation.causeOfAction', '');
  const [keyDates, setKeyDates] = usePersistentState('limitation.keyDates', '');
  const [jurisdiction, setJurisdiction] = usePersistentState('limitation.jurisdiction', 'Peninsular Malaysia (Limitation Act 1953)');
  const [additional, setAdditional] = usePersistentState('limitation.additional', '');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = usePersistentState('limitation.output', '');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const causes = [
    'Loan / Facility Agreement Breach (contract)',
    'Guarantee / Surety Enforcement',
    'Running Account / Overdraft',
    'Hire Purchase Deficiency Claim',
    'Judgment Debt Enforcement',
    'Winding Up Petition (s.466 CA 2016)',
    'Bankruptcy Petition (Insolvency Act 1967)',
    'Negligence / Tort Claim',
    'Medical Negligence',
    'Professional Negligence (solicitor / accountant)',
    'Defamation (libel / slander)',
    'Land / Foreclosure (NLC)',
    'Land Recovery / Adverse Possession',
    'Fraudulent Transaction Recovery',
    'Breach of Fiduciary Duty (director / trustee)',
    'Unfair Dismissal (s.20 IRA 1967 — 60 days)',
    'Judicial Review (Order 53 — 3 months)',
    'CIPAA Adjudication (s.28 — time limits)',
    'Specific Performance (contract for land)',
    'Matrimonial Claims (LRA 1976)',
    'Personal Injury (CLA 1956)',
    'Other — specify in additional facts',
  ];

  const jurisdictions = [
    'Peninsular Malaysia (Limitation Act 1953)',
    'Sabah (Limitation Ordinance, Cap. 72)',
    'Sarawak (Limitation Ordinance, Cap. 49)',
  ];

  const run = async () => {
    if (!causeOfAction.trim() || !keyDates.trim()) {
      setError('Please provide at least the cause of action and key dates.');
      return;
    }
    setError('');
    setOutput('');
    setDisclaimer('');
    setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/limitation',
        { causeOfAction, keyDates, jurisdiction, additionalFacts: (additional + buildContextFromFiles(uploadedFiles)).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch {
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const quickFillExamples = [
    {
      label: 'Loan Default',
      data: {
        cause: 'Loan / Facility Agreement Breach (contract)',
        dates: 'Facility dated: 15 March 2018. First default: 1 July 2020. Last payment: 30 June 2020. Formal demand letter: 1 October 2020. No acknowledgment by debtor. Today: ' + new Date().toLocaleDateString('en-GB'),
      }
    },
    {
      label: 'Judgment Enforcement',
      data: {
        cause: 'Judgment Debt Enforcement',
        dates: 'Judgment obtained: 5 January 2019. Judgment amount: RM450,000. No payments received. Today: ' + new Date().toLocaleDateString('en-GB'),
      }
    },
    {
      label: 'Guarantee Demand',
      data: {
        cause: 'Guarantee / Surety Enforcement',
        dates: 'Guarantee dated: 10 April 2017 (continuing guarantee). Principal debtor defaulted: 1 March 2020. Demand on guarantor: 15 March 2020. Guarantor did not pay. Last written acknowledgment by guarantor: 1 June 2021. Today: ' + new Date().toLocaleDateString('en-GB'),
      }
    },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/15 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Compute limitation deadlines for any civil cause of action under the Limitation Act 1953 (and Sabah/Sarawak equivalents). Covers contract, tort, land, insolvency, employment, judicial review, CIPAA, and more. Identifies whether the claim is within time, borderline, or time-barred.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Quick fill:</span>
        {quickFillExamples.map(ex => (
          <button
            key={ex.label}
            onClick={() => { setCauseOfAction(ex.data.cause); setKeyDates(ex.data.dates); }}
            className="text-xs px-3 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Cause of Action</Label>
          <Select value={causeOfAction || causes[0]} onChange={setCauseOfAction} options={causes} />
        </div>
        <div>
          <Label>Jurisdiction</Label>
          <Select value={jurisdiction} onChange={setJurisdiction} options={jurisdictions} />
        </div>
      </div>

      <div>
        <Label>Key Dates (be as specific as possible)</Label>
        <TextArea
          value={keyDates}
          onChange={setKeyDates}
          placeholder={`Include all relevant dates:
• Date of facility / agreement / judgment
• Date of first default / breach
• Date of last payment received
• Date of demand letter / statutory demand
• Any written acknowledgment of debt
• Any partial payments after default
• Today's date`}
          rows={7}
        />
      </div>

      <div>
        <Label>Additional Facts (optional)</Label>
        <TextArea value={additional} onChange={setAdditional} placeholder="Any other relevant facts — e.g. debtor is bankrupt, fraud was concealed, debtor was abroad, any court orders already made" rows={2} />
      </div>

      <div>
        <Label>Supporting Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload demand letters, agreements, acknowledgments"
          hint="PDF, DOCX, TXT  •  AI will extract dates and acknowledgments to refine the limitation analysis."
        />
      </div>

      {error && (
        <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Calculate Limitation" icon={<Clock3 className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>

      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Limitation Analysis — ${causeOfAction || 'Cause of Action'}`} />}
    </div>
  );
}

// ─── TOOL 4: AI Case Law Researcher ─────────────────────────────────────────
function CaseLawResearcher() {
  const [legalIssue, setLegalIssue] = useState('');
  const [practiceArea, setPracticeArea] = useState('');
  const [jurisdiction, setJurisdiction] = useState('All Malaysian courts');
  const [statutes, setStatutes] = useState('');
  const [context, setContext] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const practiceAreas = [
    'General Civil Litigation',
    'Contract & Commercial',
    'Banking & Finance',
    'Land Law & Property',
    'Tort / Negligence',
    'Employment & Labour',
    'Family Law',
    'Administrative Law & Judicial Review',
    'Company Law & Corporate',
    'Intellectual Property',
    'Construction & Engineering',
    'Insolvency & Bankruptcy',
    'Probate & Succession',
    'Islamic Banking & Finance',
  ];

  const jurisdictions = [
    'All Malaysian courts',
    'Federal Court only',
    'Court of Appeal and above',
    'High Court',
    'Including persuasive Commonwealth authorities',
  ];

  const run = async () => {
    if (!legalIssue.trim()) {
      setError('Please describe the legal issue to research.');
      return;
    }
    setError('');
    setOutput('');
    setDisclaimer('');
    setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/research',
        { legalIssue, jurisdiction, practiceArea, specificStatutes: statutes, additionalContext: (context + buildContextFromFiles(uploadedFiles)).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch {
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const quickExamples = [
    { label: 'Indefeasibility of Title', issue: 'Whether a purchaser who obtains title through a forged instrument acquires indefeasible title under s.340 National Land Code 1965' },
    { label: 'Summary Judgment Defence', issue: 'What constitutes a triable issue sufficient to resist a summary judgment application under Order 14 Rules of Court 2012' },
    { label: 'Unfair Dismissal Remedies', issue: 'Quantum and principles for backwages and reinstatement in unfair dismissal claims under s.20 Industrial Relations Act 1967' },
  ];

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/15 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Research Malaysian case law and authorities on any legal issue. The AI will identify leading Federal Court, Court of Appeal, and High Court decisions, analyse their ratios, and show how they apply to your specific issue.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Quick fill:</span>
        {quickExamples.map(ex => (
          <button
            key={ex.label}
            onClick={() => setLegalIssue(ex.issue)}
            className="text-xs px-3 py-1 rounded-full border border-primary/20 text-primary hover:bg-primary/10 transition-colors"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div>
        <Label>Legal Issue to Research</Label>
        <TextArea value={legalIssue} onChange={setLegalIssue} placeholder="Describe the legal question or principle you need to research. Be specific — e.g., 'Whether a bank can claim the full sale price under a BBA Islamic financing facility upon the customer's default, or must offer ibra' (rebate)'" rows={4} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Practice Area</Label>
          <Select value={practiceArea || practiceAreas[0]} onChange={setPracticeArea} options={practiceAreas} />
        </div>
        <div>
          <Label>Jurisdiction / Court Level</Label>
          <Select value={jurisdiction} onChange={setJurisdiction} options={jurisdictions} />
        </div>
      </div>

      <div>
        <Label>Specific Statutes to Consider (optional)</Label>
        <TextInput value={statutes} onChange={setStatutes} placeholder="e.g. National Land Code 1965 s.340, Contracts Act 1950 ss.73-74" />
      </div>

      <div>
        <Label>Additional Context (optional)</Label>
        <TextInput value={context} onChange={setContext} placeholder="e.g. Client is a chargee bank seeking to enforce a registered charge; chargor claims fraud" />
      </div>

      <div>
        <Label>Supporting Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload existing memos, opinions or judgments to ground the research"
          hint="PDF, DOCX, TXT  •  AI will use them to identify relevant authorities and harmonise its analysis."
        />
      </div>

      {error && (
        <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Research Case Law" icon={<BookOpen className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>

      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Case Law Research — ${practiceArea || 'Legal Issue'}`} />}
    </div>
  );
}

// ─── TOOL 5: AI Pleadings Reviewer ──────────────────────────────────────────
function PleadingsReviewer() {
  const [pleadingText, setPleadingText] = useState('');
  const [pleadingType, setPleadingType] = useState('');
  const [courtLevel, setCourtLevel] = useState('High Court in Malaya');
  const [context, setContext] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pleadingTypes = [
    'Writ of Summons & Indorsement of Claim',
    'Statement of Claim',
    'Statement of Defence',
    'Reply',
    'Counterclaim',
    'Originating Summons',
    'Affidavit in Support',
    'Affidavit in Reply',
    'Notice of Application',
    'Written Submission / Skeleton Argument',
    'Notice of Appeal',
    'Winding Up Petition',
    "Creditor's Petition (Bankruptcy)",
    'Other — please identify',
  ];

  const courts = ['High Court in Malaya', 'Court of Appeal', 'Federal Court', 'Sessions Court', "Magistrates' Court", 'Industrial Court'];

  const run = async () => {
    if (!pleadingText.trim() || pleadingText.trim().length < 100) {
      setError('Please paste the pleading text (minimum 100 characters).');
      return;
    }
    setError('');
    setOutput('');
    setDisclaimer('');
    setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/review-pleading',
        { pleadingText, pleadingType, courtLevel, additionalContext: (context + buildContextFromFiles(uploadedFiles)).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch {
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); setPleadingText(''); };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/15 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Paste any court pleading or document and receive a detailed review for compliance with the Rules of Court 2012, procedural defects, missing elements, and strategic improvements. Issues are flagged as [CRITICAL], [MAJOR], [MINOR], or [TACTICAL].
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Pleading Type</Label>
          <Select value={pleadingType || pleadingTypes[0]} onChange={setPleadingType} options={pleadingTypes} />
        </div>
        <div>
          <Label>Court Level</Label>
          <Select value={courtLevel} onChange={setCourtLevel} options={courts} />
        </div>
      </div>

      <div>
        <Label>Upload Pleading</Label>
        <FileUploadDropzone
          onFilesExtracted={(files) => {
            const usable = files.filter(f => f.text && !f.error);
            if (usable.length > 0) {
              setPleadingText(usable.map(f => `=== ${f.name} ===\n${f.text}`).join('\n\n'));
            }
          }}
          label="Upload PDF, DOCX, or TXT — text fills the box below"
          hint="Or paste manually. Supporting exhibits can also be added below."
        />
      </div>

      <div>
        <Label>Pleading Text</Label>
        <textarea
          className="w-full bg-background/60 border border-border rounded-lg px-3 py-3 text-xs text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-colors resize-none font-mono leading-relaxed"
          value={pleadingText}
          onChange={e => setPleadingText(e.target.value)}
          placeholder={"Paste the full text of the pleading here, or upload a file above…\n\nThe AI will review it for format compliance (ROC 2012), substantive defects, procedural issues, and strategic improvements."}
          rows={14}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-muted-foreground">{pleadingText.length.toLocaleString()} characters</span>
          {pleadingText && <button className="text-xs text-muted-foreground hover:text-destructive transition-colors" onClick={() => setPleadingText('')}>Clear</button>}
        </div>
      </div>

      <div>
        <Label>Additional Context — exhibits, related orders (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload exhibits, related orders, or correspondence"
          hint="PDF, DOCX, TXT  •  AI will cross-reference these against the pleading."
        />
        <div className="mt-2">
          <TextInput value={context} onChange={setContext} placeholder="e.g. This is a banking claim; defendant is expected to raise a limitation defence" />
        </div>
      </div>

      {error && (
        <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Review Pleading" icon={<ClipboardCheck className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>

      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Pleading Review — ${pleadingType || 'Pleading'}`} />}
    </div>
  );
}

// ─── TOOL 6: AI Legal Opinion Generator ─────────────────────────────────────
function LegalOpinionGenerator() {
  const [clientQuery, setClientQuery] = useState('');
  const [facts, setFacts] = useState('');
  const [questions, setQuestions] = useState('');
  const [documents, setDocuments] = useState('');
  const [urgency, setUrgency] = useState('Standard');
  const [context, setContext] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const urgencyLevels = ['Standard', 'Urgent — limitation issue', 'Urgent — court deadline', 'Preliminary / Quick advice'];

  const run = async () => {
    if (!clientQuery.trim() || !facts.trim()) {
      setError('Please provide at least the client query and material facts.');
      return;
    }
    setError('');
    setOutput('');
    setDisclaimer('');
    setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/opinion',
        { clientQuery, facts, specificQuestions: questions, relevantDocuments: documents, urgency, additionalContext: (context + buildContextFromFiles(uploadedFiles)).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch {
      setError('Failed to connect. Please try again.');
      setLoading(false);
    }
  };

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-primary/15 bg-primary/5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Generate a structured legal opinion (nasihat guaman) in proper Malaysian law firm format. The AI drafts a comprehensive opinion covering applicable law, analysis, risk assessment, and recommended course of action.
        </p>
      </div>

      <div>
        <Label>Client Query / Subject Matter</Label>
        <TextInput value={clientQuery} onChange={setClientQuery} placeholder="e.g. Whether our client has a valid claim against XYZ Bank for wrongful foreclosure of charged property" />
      </div>

      <div>
        <Label>Material Facts</Label>
        <TextArea value={facts} onChange={setFacts} placeholder={"Set out the material facts chronologically:\n• Date of loan facility, amount, parties\n• Security provided (charge, guarantee, etc.)\n• Chronology of default and bank's actions\n• Current status of the matter\n• Any correspondence or negotiations"} rows={6} />
      </div>

      <div>
        <Label>Specific Questions for Opinion (optional)</Label>
        <TextArea value={questions} onChange={setQuestions} placeholder={"List specific legal questions:\n(1) Whether the bank's foreclosure notice complied with s.254 NLC\n(2) Whether the charge is enforceable given the alleged misrepresentation\n(3) What is the quantum of damages recoverable"} rows={3} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label>Urgency</Label>
          <Select value={urgency} onChange={setUrgency} options={urgencyLevels} />
        </div>
        <div>
          <Label>Documents Reviewed (optional)</Label>
          <TextInput value={documents} onChange={setDocuments} placeholder="e.g. Facility Agreement dated 1.3.2020, Form 16A Charge, Bank's demand letter dated 5.1.2024" />
        </div>
      </div>

      <div>
        <Label>Additional Context (optional)</Label>
        <TextInput value={context} onChange={setContext} placeholder="e.g. Client is a senior citizen; property is the client's sole residence" />
      </div>

      <div>
        <Label>Source Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload contracts, charges, demand letters, prior opinions"
          hint="PDF, DOCX, TXT  •  AI will read each document and quote them in the opinion where relevant."
        />
      </div>

      {error && (
        <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Generate Legal Opinion" icon={<ScrollText className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>

      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Legal Opinion — ${clientQuery.slice(0, 60) || 'Matter'}`} />}
    </div>
  );
}

// ─── TOOL 7: AI Cross-Examination Planner ──────────────────────────────────
function CrossExamPlanner() {
  const [witnessName, setWitnessName] = useState('');
  const [witnessRole, setWitnessRole] = useState('');
  const [theirEvidence, setTheirEvidence] = useState('');
  const [ourCase, setOurCase] = useState('');
  const [keyContradictions, setKeyContradictions] = useState('');
  const [documents, setDocuments] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!witnessName.trim() || !theirEvidence.trim() || !ourCase.trim()) {
      setError('Witness name, their evidence, and our case theory are all required.'); return;
    }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/cross-exam',
        { witnessName, witnessRole, theirEvidence, ourCase, keyContradictions, documents, additionalContext: buildContextFromFiles(uploadedFiles).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Witness Name</Label>
          <TextInput value={witnessName} onChange={setWitnessName} placeholder="e.g. Encik Tan Chong Wei" />
        </div>
        <div>
          <Label>Witness Role / Side</Label>
          <TextInput value={witnessRole} onChange={setWitnessRole} placeholder="e.g. Plaintiff's bank officer (PW2)" />
        </div>
      </div>
      <div>
        <Label>Their Evidence-in-Chief (witness statement / affidavit summary)</Label>
        <TextArea value={theirEvidence} onChange={setTheirEvidence} placeholder="Summarise the witness's evidence — what they say happened, on whose authority, supported by which documents." rows={6} />
      </div>
      <div>
        <Label>Our Case Theory</Label>
        <TextArea value={ourCase} onChange={setOurCase} placeholder="In 2-3 sentences: what is OUR theory of the case and what findings of fact do we need from this witness to support it?" rows={3} />
      </div>
      <div>
        <Label>Key Contradictions / Weaknesses to Exploit (optional)</Label>
        <TextArea value={keyContradictions} onChange={setKeyContradictions} placeholder="List specific contradictions: prior statements, contemporaneous documents, common-sense propositions. Reference paragraph numbers where possible." rows={3} />
      </div>
      <div>
        <Label>Key Documents Available (optional)</Label>
        <TextInput value={documents} onChange={setDocuments} placeholder="e.g. Email dated 5.3.2023 (CB Tab 12), WhatsApp messages 1-15, Facility Agreement clause 4.2" />
      </div>
      <div>
        <Label>Supporting Materials (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload the witness statement, contradicting documents or prior depositions"
          hint="PDF, DOCX, TXT  •  AI will draw exact quotes from these for impeachment questions."
        />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Build Cross-Exam Plan" icon={<Swords className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Cross-Exam Plan — ${witnessName}`} />}
    </div>
  );
}

// ─── TOOL 8: AI Affidavit Drafter ──────────────────────────────────────────
function AffidavitDrafter() {
  const [affidavitType, setAffidavitType] = useState('Affidavit in Support');
  const [deponentName, setDeponentName] = useState('');
  const [deponentNRIC, setDeponentNRIC] = useState('');
  const [deponentCapacity, setDeponentCapacity] = useState('');
  const [deponentAddress, setDeponentAddress] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [caseNo, setCaseNo] = useState('');
  const [courtLevel, setCourtLevel] = useState('High Court in Malaya');
  const [factsToDepose, setFactsToDepose] = useState('');
  const [exhibits, setExhibits] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!deponentName.trim() || !caseTitle.trim() || !factsToDepose.trim()) {
      setError('Deponent name, case title, and facts to depose are all required.'); return;
    }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/affidavit',
        { affidavitType, deponentName, deponentNRIC, deponentCapacity, deponentAddress, caseTitle, caseNo, courtLevel, factsToDepose, exhibits, additionalContext: buildContextFromFiles(uploadedFiles).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  const types = [
    'Affidavit in Support', 'Affidavit in Reply', 'Affidavit in Opposition',
    'Affidavit Verifying List of Documents', 'Affidavit of Service',
    'Affidavit of Means', 'Affidavit of Search', 'Affidavit (general)',
  ];
  const courts = ['High Court in Malaya', 'High Court in Sabah & Sarawak', 'Sessions Court', 'Magistrates\' Court', 'Court of Appeal', 'Federal Court'];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Affidavit Type</Label><Select value={affidavitType} onChange={setAffidavitType} options={types} /></div>
        <div><Label>Court</Label><Select value={courtLevel} onChange={setCourtLevel} options={courts} /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Case Title</Label><TextInput value={caseTitle} onChange={setCaseTitle} placeholder="e.g. Malayan Banking Berhad v Ahmad bin Razali" /></div>
        <div><Label>Suit No.</Label><TextInput value={caseNo} onChange={setCaseNo} placeholder="e.g. WA-22NCC-123-04/2025" /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Deponent Name</Label><TextInput value={deponentName} onChange={setDeponentName} placeholder="Full name as per IC" /></div>
        <div><Label>Deponent NRIC</Label><TextInput value={deponentNRIC} onChange={setDeponentNRIC} placeholder="e.g. 800123-14-5678" /></div>
      </div>
      <div>
        <Label>Deponent Capacity</Label>
        <TextInput value={deponentCapacity} onChange={setDeponentCapacity} placeholder="e.g. The Plaintiff; Officer of the Plaintiff bank duly authorised; Director of the Defendant company" />
      </div>
      <div>
        <Label>Deponent Address</Label>
        <TextInput value={deponentAddress} onChange={setDeponentAddress} placeholder="Full residential or business address" />
      </div>
      <div>
        <Label>Facts to be Deposed (the deponent's account, in chronological order)</Label>
        <TextArea value={factsToDepose} onChange={setFactsToDepose} placeholder="Set out everything the deponent needs to say, in the order events occurred. Be detailed — the AI will split into proper numbered paragraphs." rows={10} />
      </div>
      <div>
        <Label>Exhibits to be Referred to (optional)</Label>
        <TextArea value={exhibits} onChange={setExhibits} placeholder="List exhibits — e.g. 'AR-1: Facility Agreement dated 1.3.2020; AR-2: Bank's demand letter dated 15.1.2025; AR-3: Land search dated 10.4.2025'" rows={3} />
      </div>
      <div>
        <Label>Source Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload contracts, letters, statements that support the facts"
          hint="PDF, DOCX, TXT  •  AI will quote them in the relevant paragraphs."
        />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Draft Affidavit" icon={<FileSignature className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Affidavit — ${deponentName}`} />}
    </div>
  );
}

// ─── TOOL 9: AI Quantum / Damages Estimator ─────────────────────────────────
function QuantumEstimator() {
  const [claimType, setClaimType] = useState('');
  const [factualMatrix, setFactualMatrix] = useState('');
  const [lossesClaimed, setLossesClaimed] = useState('');
  const [plaintiffProfile, setPlaintiffProfile] = useState('');
  const [jurisdiction, setJurisdiction] = useState('High Court');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!claimType.trim() || !factualMatrix.trim()) {
      setError('Claim type and factual matrix are required.'); return;
    }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/quantum',
        { claimType, factualMatrix, lossesClaimed, plaintiffProfile, jurisdiction, additionalContext: buildContextFromFiles(uploadedFiles).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  const claimTypes = [
    'Personal Injury — Road Traffic Accident', 'Personal Injury — Medical Negligence', 'Personal Injury — Industrial Accident',
    'Fatal Accident (Civil Law Act s. 7 / s. 8)', 'Breach of Contract — Commercial', 'Breach of Contract — Construction',
    'Defamation — Libel', 'Defamation — Slander', 'Malicious Prosecution', 'False Imprisonment',
    'Wrongful / Unlawful Dismissal', 'Constructive Dismissal', 'Breach of Fiduciary Duty', 'Conversion / Detinue',
    'Negligent Misstatement', 'Trespass to Land', 'Nuisance', 'Passing Off / Trade Mark Infringement',
    'Breach of Confidence', 'Other (specify in factual matrix)',
  ];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Claim Type</Label><Select value={claimType} onChange={setClaimType} options={['', ...claimTypes].filter(Boolean)} /></div>
        <div><Label>Court</Label><Select value={jurisdiction} onChange={setJurisdiction} options={['High Court', 'Sessions Court', 'Magistrates\' Court', 'Court of Appeal', 'Federal Court']} /></div>
      </div>
      <div>
        <Label>Factual Matrix</Label>
        <TextArea value={factualMatrix} onChange={setFactualMatrix} placeholder="Set out the material facts that affect quantum: date, location, conduct, severity, period, outcome. The AI will apply the law to these facts." rows={6} />
      </div>
      <div>
        <Label>Losses Being Claimed</Label>
        <TextArea value={lossesClaimed} onChange={setLossesClaimed} placeholder="List the heads of loss: e.g. medical expenses RM45,000; loss of earnings RM6,500/month for 8 months; pain & suffering for fractured tibia + scarring; future medical care." rows={4} />
      </div>
      <div>
        <Label>Plaintiff Profile (optional)</Label>
        <TextInput value={plaintiffProfile} onChange={setPlaintiffProfile} placeholder="Age, occupation, monthly income, dependents — relevant to multiplier and loss of future earnings" />
      </div>
      <div>
        <Label>Supporting Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload medical reports, payslips, expert reports, comparable judgments"
          hint="PDF, DOCX, TXT  •  AI will integrate evidence into the quantum analysis."
        />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Estimate Quantum" icon={<Coins className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Quantum Assessment — ${claimType}`} />}
    </div>
  );
}

// ─── TOOL 10: AI Bundle of Authorities Index ───────────────────────────────
function BundleIndexGenerator() {
  const [matterTitle, setMatterTitle] = useState('');
  const [court, setCourt] = useState('Court of Appeal');
  const [hearingType, setHearingType] = useState('');
  const [legalIssues, setLegalIssues] = useState('');
  const [knownAuthorities, setKnownAuthorities] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!matterTitle.trim() || !legalIssues.trim()) {
      setError('Matter title and legal issues are required.'); return;
    }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/bundle-index',
        { matterTitle, court, hearingType, legalIssues, knownAuthorities, additionalContext: buildContextFromFiles(uploadedFiles).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Matter Title</Label>
        <TextInput value={matterTitle} onChange={setMatterTitle} placeholder="e.g. Ahmad bin Razali v Malayan Banking Berhad — Appeal No. W-02-1234-2025" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Court</Label><Select value={court} onChange={setCourt} options={['Federal Court', 'Court of Appeal', 'High Court', 'Sessions Court']} /></div>
        <div><Label>Hearing Type</Label><TextInput value={hearingType} onChange={setHearingType} placeholder="e.g. Full appeal hearing; Motion for stay" /></div>
      </div>
      <div>
        <Label>Legal Issues (numbered)</Label>
        <TextArea value={legalIssues} onChange={setLegalIssues} placeholder="1. Whether the chargor's right to redeem extends after the auction; 2. Whether s. 340(2)(b) NLC applies to a subsequent purchaser; 3. Costs." rows={5} />
      </div>
      <div>
        <Label>Authorities Already Identified by Counsel (optional)</Label>
        <TextArea value={knownAuthorities} onChange={setKnownAuthorities} placeholder="List the cases & statutes you already plan to cite — AI will organise them and suggest additional authorities." rows={4} />
      </div>
      <div>
        <Label>Supporting Materials (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload skeleton submissions, draft submissions or judgments below"
          hint="PDF, DOCX, TXT  •  AI will extract authorities cited and integrate them into the index."
        />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Build Bundle Index" icon={<Library className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Bundle of Authorities — ${matterTitle.slice(0, 60)}`} />}
    </div>
  );
}

// ─── TOOL 11: AI Hearing Preparation Checklist ─────────────────────────────
function HearingPrep() {
  const [hearingType, setHearingType] = useState('');
  const [court, setCourt] = useState('High Court in Malaya');
  const [matterDescription, setMatterDescription] = useState('');
  const [ourPosition, setOurPosition] = useState('');
  const [opponentPosition, setOpponentPosition] = useState('');
  const [hearingDate, setHearingDate] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!hearingType.trim() || !matterDescription.trim()) {
      setError('Hearing type and matter description are required.'); return;
    }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/hearing-prep',
        { hearingType, court, matterDescription, ourPosition, opponentPosition, hearingDate, additionalContext: buildContextFromFiles(uploadedFiles).trim() },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  const hearingTypes = [
    'Case Management', 'Pre-Trial Case Management (PTCM)', 'Summary Judgment (O.14)',
    'Striking Out (O.18 r.19)', 'Setting Aside Default Judgment', 'Discovery / Specific Discovery',
    'Interlocutory Injunction', 'Mareva Injunction', 'Anton Piller', 'Originating Summons hearing',
    'Trial', 'Appeal — Court of Appeal', 'Appeal — Federal Court', 'Stay of Execution',
    'Bankruptcy — Adjudication / Receiving Order', 'Winding-Up Petition', 'Order for Sale (O.83)',
    'Taxation of Costs', 'Other',
  ];
  const courts = ['High Court in Malaya', 'High Court in Sabah & Sarawak', 'Sessions Court', 'Magistrates\' Court', 'Court of Appeal', 'Federal Court'];

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Hearing Type</Label><Select value={hearingType} onChange={setHearingType} options={['', ...hearingTypes].filter(Boolean)} /></div>
        <div><Label>Court</Label><Select value={court} onChange={setCourt} options={courts} /></div>
      </div>
      <div>
        <Label>Matter Description</Label>
        <TextArea value={matterDescription} onChange={setMatterDescription} placeholder="Brief summary of what the matter is about — parties, claim, current procedural posture." rows={4} />
      </div>
      <div>
        <Label>Our Position / Relief Sought (optional)</Label>
        <TextInput value={ourPosition} onChange={setOurPosition} placeholder="e.g. We act for the Plaintiff; we seek summary judgment for RM2.4 million" />
      </div>
      <div>
        <Label>Opponent's Position (optional)</Label>
        <TextInput value={opponentPosition} onChange={setOpponentPosition} placeholder="e.g. Defendant disputes the debt and pleads limitation under s. 6(1)(a) Limitation Act 1953" />
      </div>
      <div>
        <Label>Hearing Date (optional)</Label>
        <TextInput value={hearingDate} onChange={setHearingDate} placeholder="e.g. 15 June 2026" />
      </div>
      <div>
        <Label>Supporting Materials (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload pleadings, affidavits, prior orders to tailor the checklist"
          hint="PDF, DOCX, TXT"
        />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Build Prep Checklist" icon={<CheckSquare className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Hearing Prep — ${hearingType}`} />}
    </div>
  );
}

// ─── TOOL 12: AI Costs Estimator ───────────────────────────────────────────
function CostsEstimator() {
  const [matterType, setMatterType] = usePersistentState('costs.matterType', '');
  const [courtLevel, setCourtLevel] = usePersistentState('costs.courtLevel', 'High Court in Malaya');
  const [claimAmount, setClaimAmount] = usePersistentState('costs.claimAmount', '');
  const [stage, setStage] = usePersistentState('costs.stage', 'Full trial concluded');
  const [basis, setBasis] = usePersistentState('costs.basis', 'Party-and-party (standard basis)');
  const [complexity, setComplexity] = usePersistentState('costs.complexity', 'Moderate');
  const [workDone, setWorkDone] = usePersistentState('costs.workDone', '');
  const [output, setOutput] = usePersistentState('costs.output', '');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!matterType.trim()) { setError('Matter type is required.'); return; }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/costs-estimate',
        { matterType, courtLevel, claimAmount, stage, basis, complexity, workDone },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  const courts = ['High Court in Malaya', 'High Court in Sabah & Sarawak', 'Sessions Court', 'Magistrates\' Court', 'Court of Appeal', 'Federal Court'];
  const stages = ['Interlocutory application only', 'Settled before trial', 'Summary judgment', 'Full trial concluded', 'Appeal concluded'];
  const bases = ['Party-and-party (standard basis)', 'Solicitor-and-client (indemnity basis)', 'Both — recovery vs exposure'];
  const complexities = ['Simple / straightforward', 'Moderate', 'Complex', 'Heavy / document-intensive'];

  return (
    <div className="space-y-4">
      <div>
        <Label>Matter Type / Nature of Claim</Label>
        <TextInput value={matterType} onChange={setMatterType} placeholder="e.g. Recovery of loan debt; breach of contract; negligence" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Court Level</Label><Select value={courtLevel} onChange={setCourtLevel} options={courts} /></div>
        <div><Label>Claim Amount / Value (RM)</Label><TextInput value={claimAmount} onChange={setClaimAmount} placeholder="e.g. 850,000" /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Stage Reached</Label><Select value={stage} onChange={setStage} options={stages} /></div>
        <div><Label>Basis of Costs</Label><Select value={basis} onChange={setBasis} options={bases} /></div>
      </div>
      <div><Label>Complexity</Label><Select value={complexity} onChange={setComplexity} options={complexities} /></div>
      <div>
        <Label>Work Done / Particulars (optional)</Label>
        <TextArea value={workDone} onChange={setWorkDone} placeholder="e.g. Drafted writ + SOC, 3 interlocutory applications, 4-day trial, 2 expert witnesses, 5 bundles of documents." rows={3} />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Estimate Costs" icon={<Calculator className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Costs Estimate — ${matterType.slice(0, 60)}`} />}
    </div>
  );
}

// ─── TOOL 13: AI Settlement & Offer-to-Settle Advisor ──────────────────────
function SettlementAdvisor() {
  const [matterType, setMatterType] = usePersistentState('settlement.matterType', '');
  const [ourRole, setOurRole] = usePersistentState('settlement.ourRole', 'Plaintiff');
  const [claimAmount, setClaimAmount] = usePersistentState('settlement.claimAmount', '');
  const [strengths, setStrengths] = usePersistentState('settlement.strengths', '');
  const [weaknesses, setWeaknesses] = usePersistentState('settlement.weaknesses', '');
  const [costsIncurred, setCostsIncurred] = usePersistentState('settlement.costsIncurred', '');
  const [offerType, setOfferType] = usePersistentState('settlement.offerType', 'Recommend the most effective mechanism');
  const [objective, setObjective] = usePersistentState('settlement.objective', '');
  const [output, setOutput] = usePersistentState('settlement.output', '');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!matterType.trim()) { setError('Matter type is required.'); return; }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    try {
      await streamFromEndpoint(
        '/api/lit/ai/settlement',
        { matterType, ourRole, claimAmount, strengths, weaknesses, costsIncurred, offerType, objective },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  const roles = ['Plaintiff', 'Defendant', 'Plaintiff & Defendant (counterclaim)'];
  const offerTypes = ['Recommend the most effective mechanism', 'Offer to Settle (O.22B)', 'Calderbank offer', 'Consent judgment / settlement agreement', 'Court-annexed mediation'];

  return (
    <div className="space-y-4">
      <div>
        <Label>Matter Type / Nature of Claim</Label>
        <TextInput value={matterType} onChange={setMatterType} placeholder="e.g. Breach of contract for RM1.2m; defamation; construction payment dispute" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>We Act For</Label><Select value={ourRole} onChange={setOurRole} options={roles} /></div>
        <div><Label>Claim Amount / Value (RM)</Label><TextInput value={claimAmount} onChange={setClaimAmount} placeholder="e.g. 1,200,000" /></div>
      </div>
      <div>
        <Label>Strengths of Our Case</Label>
        <TextArea value={strengths} onChange={setStrengths} placeholder="e.g. Signed agreement, clear breach, documentary proof of loss." rows={3} />
      </div>
      <div>
        <Label>Weaknesses / Risks</Label>
        <TextArea value={weaknesses} onChange={setWeaknesses} placeholder="e.g. Limitation argument open to defendant; quantum partly speculative; a difficult witness." rows={3} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>Costs Incurred / To Trial (RM, optional)</Label><TextInput value={costsIncurred} onChange={setCostsIncurred} placeholder="e.g. 180,000 to date; 120,000 more to trial" /></div>
        <div><Label>Preferred Mechanism</Label><Select value={offerType} onChange={setOfferType} options={offerTypes} /></div>
      </div>
      <div>
        <Label>Client Objective (optional)</Label>
        <TextInput value={objective} onChange={setObjective} placeholder="e.g. Wants a fast commercial exit; or wants to vindicate reputation" />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Build Settlement Strategy" icon={<Handshake className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Settlement Strategy — ${matterType.slice(0, 60)}`} />}
    </div>
  );
}

// ─── TOOL 14: AI Cause of Action Builder ───────────────────────────────────
function CauseOfActionBuilder() {
  const [matterType, setMatterType] = usePersistentState('coa.matterType', '');
  const [partyRole, setPartyRole] = usePersistentState('coa.partyRole', 'The prospective claimant (plaintiff)');
  const [jurisdiction, setJurisdiction] = usePersistentState('coa.jurisdiction', 'Peninsular Malaysia');
  const [facts, setFacts] = usePersistentState('coa.facts', '');
  const [objective, setObjective] = usePersistentState('coa.objective', '');
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const [output, setOutput] = usePersistentState('coa.output', '');
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setOutput(''); setDisclaimer(''); setError(''); };

  const run = async () => {
    if (!matterType.trim() || !facts.trim()) { setError('Matter type and facts are required.'); return; }
    setError(''); setOutput(''); setDisclaimer(''); setLoading(true);
    const factsWithFiles = [facts, buildContextFromFiles(uploadedFiles).trim()].filter(Boolean).join('\n\n');
    try {
      await streamFromEndpoint(
        '/api/lit/ai/cause-of-action',
        { matterType, facts: factsWithFiles, partyRole, objective, jurisdiction },
        (chunk) => setOutput(prev => prev + chunk),
        (d) => { setDisclaimer(d || ''); setLoading(false); },
        (msg) => { setError(msg); setLoading(false); }
      );
    } catch { setError('Connection error. Please try again.'); setLoading(false); }
  };

  const roles = ['The prospective claimant (plaintiff)', 'The defendant (assessing a counterclaim)', 'Advising before deciding which side to sue'];
  const jurisdictions = ['Peninsular Malaysia', 'Sabah', 'Sarawak'];

  return (
    <div className="space-y-4">
      <div>
        <Label>Matter Type / Nature of Dispute</Label>
        <TextInput value={matterType} onChange={setMatterType} placeholder="e.g. Business partner withheld funds and diverted clients" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><Label>We Act For</Label><Select value={partyRole} onChange={setPartyRole} options={roles} /></div>
        <div><Label>Jurisdiction</Label><Select value={jurisdiction} onChange={setJurisdiction} options={jurisdictions} /></div>
      </div>
      <div>
        <Label>Facts</Label>
        <TextArea value={facts} onChange={setFacts} placeholder="Set out the facts chronologically — who did what, when, the loss suffered, and any documents/agreements involved." rows={6} />
      </div>
      <div>
        <Label>Client Objective (optional)</Label>
        <TextInput value={objective} onChange={setObjective} placeholder="e.g. Recover the money and stop the diversion of clients" />
      </div>
      <div>
        <Label>Supporting Documents (optional)</Label>
        <FileUploadDropzone
          onFilesExtracted={setUploadedFiles}
          label="Upload agreements, correspondence to inform the analysis"
          hint="PDF, DOCX, TXT"
        />
      </div>
      {error && <div className="flex gap-2 items-center p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      <div className="flex gap-2">
        <RunButton onClick={run} loading={loading} label="Map Causes of Action" icon={<Workflow className="h-4 w-4" />} />
        {output && <Button variant="ghost" size="sm" onClick={reset} className="mt-4 gap-1 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>}
      </div>
      {output && <LegalOutput text={output} disclaimer={disclaimer} exportTitle={`Cause of Action — ${matterType.slice(0, 60)}`} />}
    </div>
  );
}

// ─── Main Chambers Page ───────────────────────────────────────────────────────
const TOOLS = [
  {
    id: 'brief',
    label: 'Brief Writer',
    icon: Scale,
    description: 'Skeleton arguments & written submissions',
    component: BriefWriter,
  },
  {
    id: 'analyse',
    label: 'Document Analyser',
    icon: FileSearch,
    description: 'Legal document review & risk flags',
    component: DocumentAnalyser,
  },
  {
    id: 'limitation',
    label: 'Limitation Calculator',
    icon: Clock3,
    description: 'Compute limitation deadlines & risk',
    component: LimitationCalculator,
  },
  {
    id: 'research',
    label: 'Case Law Research',
    icon: BookOpen,
    description: 'Research authorities on any legal issue',
    component: CaseLawResearcher,
  },
  {
    id: 'review',
    label: 'Pleadings Reviewer',
    icon: ClipboardCheck,
    description: 'Review pleadings for defects & compliance',
    component: PleadingsReviewer,
  },
  {
    id: 'opinion',
    label: 'Legal Opinion',
    icon: ScrollText,
    description: 'Draft formal legal opinions',
    component: LegalOpinionGenerator,
  },
  {
    id: 'cross-exam',
    label: 'Cross-Exam Planner',
    icon: Swords,
    description: 'Build a structured cross-examination plan',
    component: CrossExamPlanner,
  },
  {
    id: 'affidavit',
    label: 'Affidavit Drafter',
    icon: FileSignature,
    description: 'Draft O.41-compliant affidavits with jurat & exhibits',
    component: AffidavitDrafter,
  },
  {
    id: 'quantum',
    label: 'Quantum Estimator',
    icon: Coins,
    description: 'Estimate damages from Malaysian appellate authorities',
    component: QuantumEstimator,
  },
  {
    id: 'bundle',
    label: 'Bundle of Authorities',
    icon: Library,
    description: 'Generate a court-ready Index of Authorities',
    component: BundleIndexGenerator,
  },
  {
    id: 'hearing-prep',
    label: 'Hearing Prep',
    icon: CheckSquare,
    description: 'Comprehensive hearing-day preparation checklist',
    component: HearingPrep,
  },
  {
    id: 'cause-of-action',
    label: 'Cause of Action Builder',
    icon: Workflow,
    description: 'Map causes of action, elements, forum & remedies from the facts',
    component: CauseOfActionBuilder,
  },
  {
    id: 'costs',
    label: 'Costs Estimator',
    icon: Calculator,
    description: 'Estimate party-and-party & solicitor-client costs under O.59',
    component: CostsEstimator,
  },
  {
    id: 'settlement',
    label: 'Settlement Advisor',
    icon: Handshake,
    description: 'Offer-to-settle strategy & O.22B costs consequences',
    component: SettlementAdvisor,
  },
];

export default function Chambers() {
  const [activeTool, setActiveTool] = useState('brief');
  const ActiveComponent = TOOLS.find(t => t.id === activeTool)?.component ?? BriefWriter;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Briefcase className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground tracking-tight">AI Chambers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Practitioner-grade AI tools for live matters — 14 professional tools covering briefs, analysis, research, review, opinions, limitation, cross-examination, affidavits, quantum, bundle of authorities, hearing preparation, cause-of-action mapping, costs estimates &amp; settlement strategy</p>
        </div>
      </div>

      {/* Notice */}
      <div className="flex gap-2.5 items-start p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-400/90 leading-relaxed">
          These tools are designed for qualified legal practitioners handling live matters. All AI output must be reviewed and verified by an advocate and solicitor before use. Citations must be verified against primary sources (CLJ Online, WestlawAsia, MLJ) before filing.
        </p>
      </div>

      {/* Tool selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TOOLS.map(tool => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                isActive
                  ? 'border-primary/40 bg-primary/10 shadow-inner'
                  : 'border-border bg-card hover:border-primary/20 hover:bg-secondary'
              }`}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-primary text-background' : 'bg-background border border-border text-muted-foreground'}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className={`text-sm font-semibold ${isActive ? 'text-primary' : 'text-foreground'}`}>{tool.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{tool.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active tool panel */}
      <div className="bg-card border border-border rounded-xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
          {(() => {
            const tool = TOOLS.find(t => t.id === activeTool)!;
            const Icon = tool.icon;
            return (
              <>
                <Icon className="h-5 w-5 text-primary" />
                <span className="font-semibold text-foreground">{tool.label}</span>
                <span className="text-muted-foreground text-sm">— {tool.description}</span>
              </>
            );
          })()}
        </div>
        <ActiveComponent />
      </div>
    </div>
  );
}
