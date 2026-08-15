import { useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import {
  useBundle,
  useBundleTypes,
  useAddDocument,
  useUpdateDocument,
  useDeleteDocument,
  useReorderDocuments,
  useDeleteBundle,
  useUploadBundleDocument,
  useLinkableWork,
  useLinkSavedWork,
  bundleDocumentDownloadUrl,
  BUNDLE_DOC_TYPE_LABEL,
  type DocInput,
} from '@/hooks/use-bundles';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  Badge,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  FileText,
  Layers,
  Hash,
  Scale,
  Upload,
  Download,
  Link2,
  Sparkles,
} from 'lucide-react';

const EMPTY_DOC: DocInput = { title: '', section: '', docType: 'pleading', docDate: '', pageCount: 1 };

export default function BundleDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { data: bundle, isLoading } = useBundle(Number.isNaN(id) ? null : id);
  const { data: types } = useBundleTypes();
  const addDoc = useAddDocument();
  const updateDoc = useUpdateDocument();
  const deleteDoc = useDeleteDocument();
  const reorder = useReorderDocuments();
  const deleteBundle = useDeleteBundle();
  const uploadDoc = useUploadBundleDocument();
  const linkWork = useLinkSavedWork();
  const { data: linkable } = useLinkableWork(Number.isNaN(id) ? null : id);
  const { toast } = useToast();

  const [doc, setDoc] = useState<DocInput>(EMPTY_DOC);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setD = (k: keyof DocInput, v: string | number) => setDoc((d) => ({ ...d, [k]: v }));

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading bundle…</div>;
  if (!bundle) return (
    <div className="p-12 text-center">
      <p className="text-muted-foreground mb-4">Bundle not found.</p>
      <Link href="/app/bundles" className="inline-flex items-center justify-center gap-2 rounded-md transition-all duration-200 border border-border bg-transparent hover:bg-secondary text-foreground h-11 px-6 font-medium"><ArrowLeft className="h-4 w-4" /> Back to bundles</Link>
    </div>
  );

  const items = bundle.index.items;
  const typeName = types?.bundleTypes.find((t) => t.id === bundle.bundleType)?.name ?? bundle.bundleType;

  const addDocument = async () => {
    if (!doc.title.trim()) {
      toast({ title: 'Document title required', variant: 'destructive' });
      return;
    }
    try {
      await addDoc.mutateAsync({ bundleId: bundle.id, ...doc });
      setDoc(EMPTY_DOC);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: msg.includes('subscription') ? 'Premium feature' : 'Could not add document', description: msg, variant: 'destructive' });
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const order = items.map((i) => i.id);
    const target = idx + dir;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    await reorder.mutateAsync({ bundleId: bundle.id, order });
  };

  const setPages = async (docId: number, pageCount: number) => {
    if (pageCount < 1) return;
    await updateDoc.mutateAsync({ bundleId: bundle.id, id: docId, pageCount });
  };

  const removeDoc = async (docId: number) => {
    await deleteDoc.mutateAsync({ bundleId: bundle.id, id: docId });
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      toast({ title: 'Unsupported file', description: 'Only PDF and DOCX files can be added to a bundle.', variant: 'destructive' });
      return;
    }
    try {
      await uploadDoc.mutateAsync({
        bundleId: bundle.id,
        file,
        section: doc.section || undefined,
        docType: doc.docType || 'pleading',
        docDate: doc.docDate || undefined,
      });
      toast({ title: 'Document uploaded', description: `${file.name} added to the bundle.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: msg.includes('subscription') ? 'Premium feature' : 'Upload failed', description: msg, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const linkItem = async (savedWorkId: number) => {
    try {
      await linkWork.mutateAsync({ bundleId: bundle.id, savedWorkId });
      toast({ title: 'Linked to bundle', description: 'The cause paper now appears in the index.' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: msg.includes('subscription') ? 'Premium feature' : 'Could not link', description: msg, variant: 'destructive' });
    }
  };

  const buildIndexText = () => {
    const header = [
      bundle.court || '',
      bundle.suitNo ? `Suit No: ${bundle.suitNo}` : '',
      bundle.parties || '',
      '',
      typeName.toUpperCase(),
      'INDEX',
      '',
    ].filter((l, i) => l !== '' || i < 4).join('\n');
    const rows = items.map((it) => {
      const sec = it.section ? `[${it.section}] ` : '';
      const date = it.docDate ? ` (${it.docDate})` : '';
      return `Tab ${it.tab}\t${sec}${it.title}${date}\tp. ${it.pageLabel}`;
    });
    return `${header}\n${rows.join('\n')}\n\nTotal: ${items.length} document(s), ${bundle.index.totalPages} page(s).`;
  };

  const copyIndex = () => {
    navigator.clipboard.writeText(buildIndexText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Index copied', description: 'Paste it into your bundle cover / index page.' });
  };

  const removeBundle = async () => {
    if (!confirm('Delete this bundle and all its documents? This cannot be undone.')) return;
    await deleteBundle.mutateAsync(bundle.id);
    window.history.back();
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <Link href="/app/bundles" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All bundles
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-start gap-3">
          <Layers className="h-7 w-7 text-primary shrink-0 mt-1" />
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground leading-tight">{bundle.title}</h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
              <Badge variant="outline">{typeName}</Badge>
              {bundle.parties && <span>{bundle.parties}</span>}
              {bundle.suitNo && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{bundle.suitNo}</span>}
              {bundle.court && <span className="flex items-center gap-1"><Scale className="h-3 w-3" />{bundle.court}</span>}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={removeBundle}>
          <Trash2 className="h-4 w-4" /> Delete bundle
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Add document */}
        <Card className="lg:col-span-2 h-fit">
          <CardContent className="p-5 space-y-3">
            <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Add document</h3>
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={doc.title} onChange={(e) => setD('title', e.target.value)} placeholder="e.g. Statement of Claim" />
            </div>
            <div className="space-y-1.5">
              <Label>Section / Part (optional)</Label>
              <Input value={doc.section ?? ''} onChange={(e) => setD('section', e.target.value)} placeholder="e.g. Part A — Agreed documents" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={doc.docType ?? ''} onChange={(e) => setD('docType', e.target.value)}>
                  {(types?.docTypes ?? []).map((t) => <option key={t} value={t}>{BUNDLE_DOC_TYPE_LABEL[t] ?? t}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pages</Label>
                <Input type="number" min={1} value={doc.pageCount ?? 1} onChange={(e) => setD('pageCount', Math.max(1, Number(e.target.value) || 1))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Document date (optional)</Label>
              <Input value={doc.docDate ?? ''} onChange={(e) => setD('docDate', e.target.value)} placeholder="e.g. 12.03.2026" />
            </div>
            <Button className="w-full gap-2" onClick={addDocument} disabled={addDoc.isPending}>
              <Plus className="h-4 w-4" /> {addDoc.isPending ? 'Adding…' : 'Add to bundle'}
            </Button>

            <div className="pt-2 border-t border-border/60 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => onFileChosen(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadDoc.isPending}
              >
                <Upload className="h-4 w-4" /> {uploadDoc.isPending ? 'Uploading…' : 'Upload pleading (PDF / DOCX)'}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Uploaded files are stored with the bundle — the title, type, section and date above are applied to the upload.
              </p>
            </div>

            {(linkable?.items?.length ?? 0) > 0 && (
              <div className="pt-2 border-t border-border/60 space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Cause papers from {linkable?.matterScoped ? 'this matter' : 'your saved work'}
                </h4>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {linkable!.items.map((w) => (
                    <div key={w.id} className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-foreground truncate">{w.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{w.kind}{w.matter ? ` · ${w.matter}` : ''}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-primary shrink-0"
                        onClick={() => linkItem(w.id)}
                        disabled={linkWork.isPending}
                      >
                        <Link2 className="h-3.5 w-3.5" /> Link
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Index */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-semibold text-foreground">Index &amp; pagination</h3>
              {items.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copyIndex}>
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy index</>}
                </Button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No documents yet. Add documents and the index builds itself.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                  <span className="w-8">Tab</span>
                  <span className="flex-1">Document</span>
                  <span className="w-16 text-center">Pages</span>
                  <span className="w-20 text-right">Page no.</span>
                  <span className="w-16" />
                </div>
                {items.map((it, idx) => (
                  <div key={it.id} className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 hover:bg-background/40 group">
                    <span className="w-8 font-mono text-sm font-bold text-primary">{it.tab}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{it.title}</span>
                        {it.hasFile && (
                          <a
                            href={bundleDocumentDownloadUrl(bundle.id, it.id)}
                            className="text-primary hover:text-primary/80 shrink-0"
                            title={`Download ${it.fileName ?? 'file'}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {it.source === 'saved-work' && (
                          <Badge variant="outline" className="shrink-0 text-[9px] px-1.5 py-0">Cause paper</Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <span>{BUNDLE_DOC_TYPE_LABEL[it.docType] ?? it.docType}</span>
                        {it.section && <span>· {it.section}</span>}
                        {it.docDate && <span>· {it.docDate}</span>}
                        {it.fileName && <span>· {it.fileName}</span>}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      defaultValue={it.pageCount}
                      onBlur={(e) => { const v = Number(e.target.value); if (v >= 1 && v !== it.pageCount) setPages(it.id, v); }}
                      className="w-16 h-8 text-center text-sm"
                    />
                    <span className="w-20 text-right font-mono text-sm text-foreground">{it.pageLabel}</span>
                    <div className="w-16 flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20"><ChevronUp className="h-4 w-4" /></button>
                      <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="p-1 text-muted-foreground hover:text-primary disabled:opacity-20"><ChevronDown className="h-4 w-4" /></button>
                      <button onClick={() => removeDoc(it.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-3 mt-1 text-sm">
                  <span className="text-muted-foreground">{items.length} document(s)</span>
                  <span className="font-mono font-semibold text-foreground">{bundle.index.totalPages} page(s) · ends p. {bundle.index.lastPage}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
