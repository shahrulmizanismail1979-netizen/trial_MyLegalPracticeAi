import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  useMatter,
  useMatterWork,
  useUpdateMatter,
  useDeleteMatter,
  useDeleteWork,
  useDeadlineTriggers,
  useComputeDeadlines,
  useAddDeadline,
  useAddDeadlinesBulk,
  useUpdateDeadline,
  useDeleteDeadline,
  categoryMeta,
  daysUntil,
  matterTypeLabel,
  SYA_MATTER_TYPES,
  SYA_COURTS,
  type ComputedDeadline,
  type MatterInput,
} from "@/hooks/use-matters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import {
  ArrowLeft,
  FileText,
  Trash2,
  Pencil,
  CalendarClock,
  Plus,
  Wand2,
  Eye,
  Check,
  AlertTriangle,
  Workflow,
  Loader2,
  Copy,
} from "lucide-react";

function fmtDate(iso: string, mode: string) {
  return new Date(iso).toLocaleDateString(mode === "bm" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MatterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const [, navigate] = useLocation();
  const { t, ts, mode } = useLanguage();
  const { toast } = useToast();

  const { data: matter, isLoading } = useMatter(Number.isNaN(id) ? null : id);
  const { data: work } = useMatterWork(Number.isNaN(id) ? null : id);
  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const deleteWork = useDeleteWork();
  const { data: triggers } = useDeadlineTriggers();
  const computeDl = useComputeDeadlines();
  const addDl = useAddDeadline();
  const addBulk = useAddDeadlinesBulk();
  const updateDl = useUpdateDeadline();
  const deleteDl = useDeleteDeadline();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ title: string; content: string } | null>(null);
  const [dlOpen, setDlOpen] = useState(false);
  const [dlTitle, setDlTitle] = useState("");
  const [dlDate, setDlDate] = useState("");
  const [computeOpen, setComputeOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [preview, setPreview] = useState<ComputedDeadline[] | null>(null);

  if (isLoading) {
    return <div className="p-8 text-center text-secondary animate-pulse">{t("Loading matter…", "Memuatkan fail kes…")}</div>;
  }
  if (!matter) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">{t("Matter not found.", "Fail kes tidak dijumpai.")}</p>
        <Link href="/matters"><Button variant="outline">{t("Back to matters", "Kembali ke fail kes")}</Button></Link>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({
      title: matter.title,
      clientName: matter.clientName ?? "",
      actingFor: matter.actingFor ?? "",
      plaintiff: matter.plaintiff ?? "",
      defendant: matter.defendant ?? "",
      matterType: matter.matterType ?? "",
      court: matter.court ?? "",
      caseNo: matter.caseNo ?? "",
      claimAmount: matter.claimAmount ?? "",
      status: matter.status,
      notes: matter.notes ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    await updateMatter.mutateAsync({ id: matter.id, ...editForm });
    setEditOpen(false);
    toast({ title: ts("Matter updated", "Fail kes dikemas kini") });
  };

  const doDelete = async () => {
    await deleteMatter.mutateAsync(matter.id);
    toast({ title: ts("Matter deleted", "Fail kes dipadam") });
    navigate("/matters");
  };

  const runCompute = async () => {
    if (!trigger || !triggerDate) return;
    const rows = await computeDl.mutateAsync({ matterId: matter.id, trigger, triggerDate });
    setPreview(rows);
  };

  const addComputed = async () => {
    if (!preview || preview.length === 0) return;
    await addBulk.mutateAsync({
      matterId: matter.id,
      deadlines: preview.map((p) => ({
        title: p.title, dueDate: p.dueDate, category: p.category, basis: p.basis, notes: p.notes,
      })),
    });
    setComputeOpen(false);
    setPreview(null);
    setTrigger("");
    setTriggerDate("");
    toast({ title: ts("Deadlines added to diary", "Tarikh akhir ditambah ke diari") });
  };

  const infoRows: { label: string; value: string | null }[] = [
    { label: ts("Client", "Klien"), value: matter.clientName },
    { label: ts("Acting for", "Bertindak bagi"), value: matter.actingFor },
    { label: ts("Plaintiff / Applicant", "Plaintif / Pemohon"), value: matter.plaintiff },
    { label: ts("Defendant / Respondent", "Defendan / Responden"), value: matter.defendant },
    { label: ts("Court", "Mahkamah"), value: matter.court },
    { label: ts("Case no.", "No. kes"), value: matter.caseNo },
    { label: ts("Matter type", "Jenis kes"), value: matter.matterType ? matterTypeLabel(matter.matterType, mode) : null },
    { label: ts("Claim (RM)", "Tuntutan (RM)"), value: matter.claimAmount },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0">
          <Link href="/matters">
            <button className="text-xs text-muted-foreground hover:text-secondary flex items-center gap-1 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> {t("All matters", "Semua fail kes")}
            </button>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="matter-detail-title">{matter.title}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/workflows">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Workflow className="h-3.5 w-3.5" /> {t("Syariah procedure", "Tatacara Syariah")}
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit} data-testid="matter-edit">
            <Pencil className="h-3.5 w-3.5" /> {t("Edit", "Sunting")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-red-400 border-red-900/40 hover:bg-red-950/30" onClick={() => setDeleteOpen(true)} data-testid="matter-delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          {infoRows.filter((r) => r.value).map((r) => (
            <div key={r.label}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{r.label}</p>
              <p className="text-sm text-foreground mt-0.5">{r.value}</p>
            </div>
          ))}
          {matter.notes && (
            <div className="col-span-2 md:col-span-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t("Notes", "Catatan")}</p>
              <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{matter.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deadline diary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-secondary" /> {t("Deadline diary", "Diari tarikh akhir")}
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setComputeOpen(true)} data-testid="deadline-compute">
              <Wand2 className="h-3.5 w-3.5" /> {t("Compute from event", "Kira dari peristiwa")}
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDlOpen(true)} data-testid="deadline-add">
              <Plus className="h-3.5 w-3.5" /> {t("Add deadline", "Tambah tarikh akhir")}
            </Button>
          </div>
        </div>
        {matter.deadlines.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
            {t(
              "No deadlines yet. Compute the standard periods from a procedural event (e.g. saman served, judgment given) or add one manually.",
              "Tiada tarikh akhir lagi. Kira tempoh lazim daripada peristiwa tatacara (cth. saman diserahkan, penghakiman diberikan) atau tambah secara manual.",
            )}
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-0 divide-y divide-border">
            {matter.deadlines.map((d) => {
              const days = daysUntil(d.dueDate);
              const cat = categoryMeta(d.category);
              const done = d.status === "done";
              return (
                <div key={d.id} className="p-4 flex items-start gap-3" data-testid={`deadline-row-${d.id}`}>
                  <button
                    onClick={() => updateDl.mutate({ matterId: matter.id, id: d.id, status: done ? "pending" : "done" })}
                    className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      done ? "bg-emerald-600 border-emerald-600 text-white" : "border-border hover:border-secondary"
                    }`}
                    title={ts("Toggle done", "Tanda selesai")}
                  >
                    {done && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{fmtDate(d.dueDate, mode)}</span>
                      {!done && (days < 0 ? (
                        <span className="inline-flex items-center gap-1 text-red-400 font-semibold">
                          <AlertTriangle className="h-3 w-3" /> {t("overdue", "tertunggak")} {Math.abs(days)}d
                        </span>
                      ) : (
                        <span className={days <= 7 ? "text-amber-400 font-semibold" : ""}>
                          {days === 0 ? t("today", "hari ini") : `${days}d`}
                        </span>
                      ))}
                      {d.basis && <span className="italic">{d.basis}</span>}
                    </div>
                    {d.notes && <p className="text-[11px] text-muted-foreground/80 mt-1">{d.notes}</p>}
                  </div>
                  <button
                    onClick={() => deleteDl.mutate({ matterId: matter.id, id: d.id })}
                    className="text-muted-foreground/50 hover:text-red-400 transition-colors shrink-0"
                    title={ts("Delete", "Padam")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </CardContent></Card>
        )}
      </div>

      {/* Filed documents */}
      <div className="space-y-3">
        <h2 className="text-lg font-serif font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-secondary" /> {t("Filed documents", "Dokumen difailkan")}
        </h2>
        {(work ?? []).length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">
            {t(
              "No documents filed yet. Generate a cause paper or document, then choose “Save into a matter file”.",
              "Tiada dokumen difailkan lagi. Jana kertas kausa atau dokumen, kemudian pilih “Simpan ke dalam fail kes”.",
            )}
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(work ?? []).map((w) => (
              <Card key={w.id} className="hover:border-secondary/40 transition-colors" data-testid={`work-card-${w.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground leading-snug">{w.title}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold shrink-0">{w.kind}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{w.content.slice(0, 220)}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">{fmtDate(w.createdAt, mode)}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setViewDoc({ title: w.title, content: w.content })} data-testid={`work-view-${w.id}`}>
                        <Eye className="h-3.5 w-3.5" /> {t("View", "Lihat")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-red-400" onClick={() => deleteWork.mutate({ matterId: matter.id, id: w.id })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* View document modal */}
      <Dialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{viewDoc?.title}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 rounded-lg bg-muted/30 p-4">
            <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">{viewDoc?.content}</pre>
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline" size="sm" className="gap-1.5"
              onClick={() => { if (viewDoc) { navigator.clipboard.writeText(viewDoc.content); toast({ title: ts("Copied", "Disalin") }); } }}
            >
              <Copy className="h-3.5 w-3.5" /> {t("Copy", "Salin")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual deadline modal */}
      <Dialog open={dlOpen} onOpenChange={setDlOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{t("Add deadline", "Tambah tarikh akhir")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("What is due?", "Apa yang perlu?")}</Label>
              <Input value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} data-testid="deadline-form-title" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("Due date", "Tarikh akhir")}</Label>
              <Input type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} data-testid="deadline-form-date" />
            </div>
            <Button
              className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              disabled={!dlTitle.trim() || !dlDate || addDl.isPending}
              onClick={async () => {
                await addDl.mutateAsync({ matterId: matter.id, title: dlTitle.trim(), dueDate: new Date(`${dlDate}T09:00:00`).toISOString() });
                setDlOpen(false); setDlTitle(""); setDlDate("");
              }}
              data-testid="deadline-form-submit"
            >
              {t("Add to diary", "Tambah ke diari")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compute-from-trigger modal */}
      <Dialog open={computeOpen} onOpenChange={(o) => { setComputeOpen(o); if (!o) setPreview(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Compute deadlines from an event", "Kira tarikh akhir daripada peristiwa")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("Procedural event", "Peristiwa tatacara")}</Label>
              <Select value={trigger} onValueChange={(v) => { setTrigger(v); setPreview(null); }}>
                <SelectTrigger data-testid="compute-trigger"><SelectValue placeholder={ts("Select event…", "Pilih peristiwa…")} /></SelectTrigger>
                <SelectContent>
                  {(triggers ?? []).map((tr) => <SelectItem key={tr.trigger} value={tr.trigger}>{tr.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {trigger && <p className="text-[11px] text-muted-foreground">{(triggers ?? []).find((x) => x.trigger === trigger)?.description}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("Event date", "Tarikh peristiwa")}</Label>
              <Input type="date" value={triggerDate} onChange={(e) => { setTriggerDate(e.target.value); setPreview(null); }} data-testid="compute-date" />
            </div>
            {!preview ? (
              <Button className="w-full" variant="outline" disabled={!trigger || !triggerDate || computeDl.isPending} onClick={runCompute} data-testid="compute-run">
                {computeDl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4 mr-1.5" />}
                {t("Preview deadlines", "Pratonton tarikh akhir")}
              </Button>
            ) : (
              <>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {preview.map((p, i) => {
                    const cat = categoryMeta(p.category);
                    return (
                      <div key={i} className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{p.title}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{fmtDate(p.dueDate, mode)}</span> · <span className="italic">{p.basis}</span>
                        </p>
                        {p.notes && <p className="text-[11px] text-muted-foreground/80 mt-1">{p.notes}</p>}
                      </div>
                    );
                  })}
                  {preview.length === 0 && <div className="p-3 text-sm text-muted-foreground">{t("No standard deadlines for this event.", "Tiada tarikh akhir lazim untuk peristiwa ini.")}</div>}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "Ordinary Federal-Territories periods — always verify against the applicable state enactment and the sealed documents.",
                    "Tempoh lazim Wilayah Persekutuan — sentiasa sahkan dengan enakmen negeri yang terpakai dan dokumen yang dimeterai.",
                  )}
                </p>
                <Button
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  disabled={preview.length === 0 || addBulk.isPending}
                  onClick={addComputed}
                  data-testid="compute-save"
                >
                  {t("Add all to diary", "Tambah semua ke diari")}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit matter modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("Edit matter", "Sunting fail kes")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("Title", "Tajuk")}</Label>
              <Input value={editForm.title ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Client", "Klien")}</Label>
                <Input value={editForm.clientName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Case no.", "No. kes")}</Label>
                <Input value={editForm.caseNo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, caseNo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Matter type", "Jenis kes")}</Label>
                <Select value={editForm.matterType ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, matterType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYA_MATTER_TYPES.map((tt) => <SelectItem key={tt.value} value={tt.value}>{mode === "bm" ? tt.bm : tt.en}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Court", "Mahkamah")}</Label>
                <Select value={editForm.court ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, court: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYA_COURTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Status", "Status")}</Label>
              <Select value={editForm.status ?? "active"} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="matter-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("Active", "Aktif")}</SelectItem>
                  <SelectItem value="on-hold">{t("On Hold", "Tergantung")}</SelectItem>
                  <SelectItem value="closed">{t("Closed", "Ditutup")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Notes", "Catatan")}</Label>
              <Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>{t("Cancel", "Batal")}</Button>
              <Button className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground" onClick={saveEdit} disabled={updateMatter.isPending} data-testid="matter-edit-save">
                {t("Save", "Simpan")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("Delete this matter?", "Padam fail kes ini?")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "This permanently deletes the matter, its filed documents and its deadline diary.",
              "Ini akan memadamkan fail kes, dokumen yang difailkan dan diari tarikh akhirnya secara kekal.",
            )}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>{t("Cancel", "Batal")}</Button>
            <Button variant="destructive" className="flex-1" onClick={doDelete} disabled={deleteMatter.isPending} data-testid="matter-delete-confirm">
              {t("Delete", "Padam")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
