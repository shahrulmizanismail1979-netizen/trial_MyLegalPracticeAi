import { useState, useMemo } from 'react';
import {
  useSavedWork,
  useUpdateWork,
  useDeleteWork,
  kindMeta,
  type SavedWork,
} from '@/hooks/use-saved-work';
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Modal,
  Input,
} from '@/components/ui';
import { ExportButtons } from '@/components/ExportButtons';
import {
  FolderOpen,
  FileText,
  Trash2,
  Pencil,
  Eye,
  Search,
  Briefcase,
  Clock,
} from 'lucide-react';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Lightweight markdown-ish renderer for the view modal
function RenderedContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="bg-background border border-border rounded-xl p-6 max-h-[60vh] overflow-y-auto space-y-0.5 font-mono text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (/^#{1,3}\s/.test(line)) {
          const level = line.match(/^(#+)/)?.[1].length ?? 1;
          const content = line.replace(/^#+\s*/, '');
          const cls =
            level === 1
              ? 'text-lg font-serif font-bold text-primary mt-5 mb-2'
              : level === 2
                ? 'text-base font-bold text-primary mt-4 mb-1'
                : 'text-sm font-bold text-foreground mt-3 mb-1 uppercase tracking-wide';
          return <div key={i} className={cls}>{content}</div>;
        }
        if (/^---/.test(line) || /^\*\*\*/.test(line)) return <hr key={i} className="border-border my-3" />;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-foreground/90">{line}</p>;
      })}
    </div>
  );
}

export default function MyWork() {
  const { data: items, isLoading } = useSavedWork();
  const updateWork = useUpdateWork();
  const deleteWork = useDeleteWork();

  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<SavedWork | null>(null);
  const [renaming, setRenaming] = useState<SavedWork | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameMatter, setRenameMatter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<SavedWork | null>(null);

  const grouped = useMemo(() => {
    const filtered = (items ?? []).filter((it) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        it.title.toLowerCase().includes(q) ||
        (it.matter ?? '').toLowerCase().includes(q) ||
        it.content.toLowerCase().includes(q)
      );
    });
    const map = new Map<string, SavedWork[]>();
    for (const it of filtered) {
      const key = it.matter?.trim() || 'Unfiled Work';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [items, search]);

  const openRename = (it: SavedWork) => {
    setRenaming(it);
    setRenameTitle(it.title);
    setRenameMatter(it.matter ?? '');
  };

  const submitRename = async () => {
    if (!renaming) return;
    await updateWork.mutateAsync({ id: renaming.id, title: renameTitle.trim() || renaming.title, matter: renameMatter.trim() });
    setRenaming(null);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    await deleteWork.mutateAsync(confirmDelete.id);
    setConfirmDelete(null);
  };

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading your saved work…</div>;

  const total = items?.length ?? 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="My Work"
        description="Everything you generate and save — briefs, drafts, analyses and research — kept here, organised by matter, ready when you return."
      />

      {total === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-1">No saved work yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              When you generate a skeleton argument, draft a cause paper, run a limitation check
              or analyse a document, click <span className="text-primary font-medium">“Save to My Work”</span> and it
              will appear here — so you never start from scratch after lunch or the next morning.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by matter, title or content…"
              className="pl-9"
            />
          </div>

          <div className="space-y-8">
            {grouped.map(([matter, works]) => (
              <div key={matter}>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <h2 className="font-serif font-bold text-lg text-foreground">{matter}</h2>
                  <Badge variant="outline" className="ml-1">{works.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {works.map((it) => {
                    const meta = kindMeta(it.kind);
                    return (
                      <Card key={it.id} className="flex flex-col hover:border-primary/50 transition-all">
                        <CardContent className="p-4 flex flex-col gap-3 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.color}`}>
                              {meta.label}
                            </span>
                            <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          </div>
                          <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">{it.title}</h3>
                          <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                            {it.content.replace(/[#*`>-]/g, '').slice(0, 120) || 'No content'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Clock className="h-3 w-3" /> {formatDate(it.updatedAt)}
                          </div>
                          <div className="flex gap-1.5 pt-1">
                            <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs" onClick={() => setViewing(it)}>
                              <Eye className="h-3.5 w-3.5" /> Open
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openRename(it)} title="Rename / move">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(it)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* View modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? 'Saved Work'}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${kindMeta(viewing.kind).color}`}>
                {kindMeta(viewing.kind).label}
              </span>
              <ExportButtons title={viewing.title} content={viewing.content} />
            </div>
            {viewing.matter && (
              <p className="text-xs text-muted-foreground">Matter: <span className="text-foreground">{viewing.matter}</span></p>
            )}
            <RenderedContent text={viewing.content} />
          </div>
        )}
      </Modal>

      {/* Rename modal */}
      <Modal isOpen={!!renaming} onClose={() => setRenaming(null)} title="Rename / Move to Matter">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Title</label>
            <Input value={renameTitle} onChange={(e) => setRenameTitle(e.target.value)} placeholder="Document title" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Matter / Case (optional)</label>
            <Input value={renameMatter} onChange={(e) => setRenameMatter(e.target.value)} placeholder="e.g. Maybank v Ahmad bin Ali" />
            <p className="text-xs text-muted-foreground">Group related work under the same matter name.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button className="flex-1" onClick={submitRename} disabled={updateWork.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete saved work?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="text-foreground font-medium">“{confirmDelete?.title}”</span>. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={deleteWork.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
