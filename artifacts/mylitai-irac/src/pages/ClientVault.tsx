import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Lock,
  Loader2,
  ShieldCheck,
  Plus,
  Users,
  FileText,
  Upload,
  Download,
  Trash2,
  ArrowLeft,
  Briefcase,
  FolderOpen,
  LogOut,
  Link2,
  CircleAlert,
  Building2,
  User as UserIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  vaultVerify,
  vaultLogin,
  vaultLogout,
  listVaultClients,
  getVaultClient,
  createVaultClient,
  updateVaultClient,
  deleteVaultClient,
  uploadVaultDocument,
  deleteVaultDocument,
  vaultDocumentDownloadUrl,
  getAssignableItems,
  linkWorkToClient,
  linkMatterToClient,
  type VaultClient,
  type VaultClientDetail,
} from "@/lib/irac-api";

const inputCls = "mt-1";

function formatBytes(n: number | null): string {
  if (!n || n <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

// ─── Login gate (covers ONLY the vault) ──────────────────────────────────────
function VaultLogin({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await vaultLogin(password.trim());
      onSuccess();
    } catch (err) {
      setError((err as Error).message || t("vault.login.invalid"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16 w-full">
      <Card className="card-elegant">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[hsl(var(--gold))]/15 ring-1 ring-[hsl(var(--gold))]/40">
              <Lock className="h-6 w-6 text-[hsl(var(--gold-bright))]" />
            </span>
            <h1 className="font-serif text-2xl font-bold text-gradient-gold">{t("vault.login.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("vault.login.desc")}</p>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--gold))]/10 px-3 py-1 text-[11px] font-sans font-medium text-[hsl(var(--gold-bright))] ring-1 ring-[hsl(var(--gold))]/30">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("vault.login.confidential")}
            </span>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>{t("vault.login.passcode")}</Label>
              <Input
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoFocus
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4" />
                {error}
              </div>
            )}
            <Button type="submit" disabled={busy} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t("vault.login.button")}
            </Button>
          </form>
          <div className="flex items-start gap-2.5 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--gold-bright))]" />
            <p className="text-xs text-muted-foreground leading-relaxed">{t("vault.login.privacy")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── New / edit client form ──────────────────────────────────────────────────
function ClientForm({
  initial,
  onSubmit,
  onCancel,
  busy,
}: {
  initial?: Partial<VaultClient>;
  onSubmit: (v: Record<string, string>) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    reference: initial?.reference ?? "",
    clientType: initial?.clientType ?? "individual",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
  });
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{t("vault.form.name")}</Label>
            <Input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("vault.form.namePlaceholder")} />
          </div>
          <div>
            <Label>{t("vault.form.reference")}</Label>
            <Input className={inputCls} value={form.reference} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. 2026/042" />
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>{t("vault.form.type")}</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))] mt-1"
              value={form.clientType}
              onChange={(e) => set("clientType", e.target.value)}
            >
              <option value="individual">{t("vault.type.individual")}</option>
              <option value="company">{t("vault.type.company")}</option>
            </select>
          </div>
          <div>
            <Label>{t("vault.form.email")}</Label>
            <Input className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div>
            <Label>{t("vault.form.phone")}</Label>
            <Input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>{t("vault.form.address")}</Label>
          <Textarea className={inputCls} rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>{t("common.cancel")}</Button>
          <Button onClick={() => onSubmit(form)} disabled={busy || !form.name.trim()} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Client detail ───────────────────────────────────────────────────────────
function ClientDetail({ clientId, onBack }: { clientId: number; onBack: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const { data: client, isLoading } = useQuery<VaultClientDetail>({
    queryKey: ["vault", "client", clientId],
    queryFn: () => getVaultClient(clientId),
  });

  useEffect(() => {
    if (client) {
      setNotes(client.notes ?? "");
      setNotesDirty(false);
    }
  }, [client]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["vault", "client", clientId] });
    qc.invalidateQueries({ queryKey: ["vault", "clients"] });
    qc.invalidateQueries({ queryKey: ["vault", "assignable"] });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadVaultDocument(clientId, file);
      }
      toast({ title: t("vault.doc.uploaded") });
      invalidate();
    } catch (err) {
      toast({ title: t("vault.doc.uploadFailed"), description: (err as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveNotes = useMutation({
    mutationFn: () => updateVaultClient(clientId, { notes }),
    onSuccess: () => {
      setNotesDirty(false);
      toast({ title: t("vault.notes.saved") });
      invalidate();
    },
    onError: (e) => toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" }),
  });

  const removeDoc = useMutation({
    mutationFn: (docId: number) => deleteVaultDocument(docId),
    onSuccess: () => {
      toast({ title: t("vault.doc.deleted") });
      invalidate();
    },
    onError: (e) => toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" }),
  });

  if (isLoading || !client) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("vault.backToClients")}
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[hsl(var(--gold))]/15 ring-1 ring-[hsl(var(--gold))]/30">
            {client.clientType === "company" ? (
              <Building2 className="h-6 w-6 text-[hsl(var(--gold-bright))]" />
            ) : (
              <UserIcon className="h-6 w-6 text-[hsl(var(--gold-bright))]" />
            )}
          </span>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">{client.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[client.reference, client.email, client.phone].filter(Boolean).join(" · ") || t("vault.noContact")}
            </p>
          </div>
        </div>
      </div>

      {/* Documents */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> {t("vault.documents")}
            </h2>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t("vault.doc.upload")}
            </Button>
          </div>
          {client.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">{t("vault.doc.empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {client.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{d.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(d.sizeBytes)} {d.contentType ? `· ${d.contentType}` : ""}
                    </p>
                  </div>
                  <a href={vaultDocumentDownloadUrl(d.id)} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" /> {t("common.download")}
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(t("vault.doc.confirmDelete"))) removeDoc.mutate(d.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Linked work & matters */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-primary" /> {t("vault.organisedWork")}
            </h2>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowLink((s) => !s)}>
              <Link2 className="h-4 w-4" /> {t("vault.link.manage")}
            </Button>
          </div>

          {showLink && <LinkPanel clientId={clientId} onChanged={invalidate} />}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5" /> {t("vault.savedWork")}
              </p>
              {client.work.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t("vault.work.empty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {client.work.map((w) => (
                    <li key={w.id} className="text-sm text-foreground/90 border border-border rounded px-3 py-2">
                      <span className="text-[10px] font-mono uppercase text-primary mr-2">{w.kind}</span>
                      {w.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> {t("vault.matters")}
              </p>
              {client.matters.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">{t("vault.matters.empty")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {client.matters.map((m) => (
                    <li key={m.id} className="text-sm text-foreground/90 border border-border rounded px-3 py-2">
                      {m.title}
                      {m.suitNo && <span className="text-xs text-muted-foreground ml-2">{m.suitNo}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <h2 className="font-serif text-lg font-semibold text-foreground">{t("vault.notes")}</h2>
          <Textarea
            rows={4}
            value={notes}
            placeholder={t("vault.notes.placeholder")}
            onChange={(e) => {
              setNotes(e.target.value);
              setNotesDirty(true);
            }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => saveNotes.mutate()} disabled={!notesDirty || saveNotes.isPending} className="gap-1.5">
              {saveNotes.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("vault.notes.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Link panel: attach existing saved work / matters to this client ─────────
function LinkPanel({ clientId, onChanged }: { clientId: number; onChanged: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["vault", "assignable"],
    queryFn: getAssignableItems,
  });

  const toggleWork = async (workId: number, currentlyLinked: boolean) => {
    try {
      await linkWorkToClient(workId, currentlyLinked ? null : clientId);
      onChanged();
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" });
    }
  };
  const toggleMatter = async (matterId: number, currentlyLinked: boolean) => {
    try {
      await linkMatterToClient(matterId, currentlyLinked ? null : clientId);
      onChanged();
    } catch (e) {
      toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  const work = data?.work ?? [];
  const matters = data?.matters ?? [];

  return (
    <div className="border border-border rounded-lg p-4 bg-background/40 space-y-4">
      <p className="text-xs text-muted-foreground">{t("vault.link.desc")}</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("vault.savedWork")}</p>
          {work.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t("vault.link.noWork")}</p>
          ) : (
            <ul className="space-y-1 max-h-56 overflow-y-auto">
              {work.map((w) => {
                const linkedHere = w.clientId === clientId;
                const linkedElsewhere = w.clientId != null && !linkedHere;
                return (
                  <li key={w.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={linkedHere} disabled={linkedElsewhere} onChange={() => toggleWork(w.id, linkedHere)} className="accent-[hsl(var(--gold))]" />
                    <span className={`flex-1 truncate ${linkedElsewhere ? "text-muted-foreground/50" : "text-foreground/90"}`}>
                      {w.title}
                      {linkedElsewhere && <span className="text-xs ml-1">({t("vault.link.otherClient")})</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("vault.matters")}</p>
          {matters.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t("vault.link.noMatters")}</p>
          ) : (
            <ul className="space-y-1 max-h-56 overflow-y-auto">
              {matters.map((m) => {
                const linkedHere = m.clientId === clientId;
                const linkedElsewhere = m.clientId != null && !linkedHere;
                return (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={linkedHere} disabled={linkedElsewhere} onChange={() => toggleMatter(m.id, linkedHere)} className="accent-[hsl(var(--gold))]" />
                    <span className={`flex-1 truncate ${linkedElsewhere ? "text-muted-foreground/50" : "text-foreground/90"}`}>
                      {m.title}
                      {linkedElsewhere && <span className="text-xs ml-1">({t("vault.link.otherClient")})</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Client list ─────────────────────────────────────────────────────────────
function ClientList({ onOpen, onLogout }: { onOpen: (id: number) => void; onLogout: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["vault", "clients"],
    queryFn: listVaultClients,
  });

  const create = useMutation({
    mutationFn: (v: Record<string, string>) => createVaultClient(v),
    onSuccess: (c) => {
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["vault", "clients"] });
      toast({ title: t("vault.created") });
      onOpen(c.id);
    },
    onError: (e) => toast({ title: t("common.error"), description: (e as Error).message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">{t("vault.title")}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{t("vault.desc")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> {t("vault.logout")}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreating((c) => !c)}>
            <Plus className="h-4 w-4" /> {t("vault.newClient")}
          </Button>
        </div>
      </div>
      <div className="rule-gold" />

      {creating && (
        <ClientForm onSubmit={(v) => create.mutate(v)} onCancel={() => setCreating(false)} busy={create.isPending} />
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">{t("vault.empty")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((c) => (
            <button key={c.id} onClick={() => onOpen(c.id)} className="text-left">
              <Card className="card-elegant hover:ring-1 hover:ring-[hsl(var(--gold))]/40 transition-all h-full">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    {c.clientType === "company" ? (
                      <Building2 className="h-5 w-5 text-[hsl(var(--gold-bright))] shrink-0" />
                    ) : (
                      <UserIcon className="h-5 w-5 text-[hsl(var(--gold-bright))] shrink-0" />
                    )}
                    <h3 className="font-serif text-lg font-semibold text-foreground leading-tight truncate">{c.name}</h3>
                  </div>
                  {c.reference && <p className="text-xs text-muted-foreground">{c.reference}</p>}
                  {(c.email || c.phone) && (
                    <p className="text-xs text-muted-foreground truncate">{[c.email, c.phone].filter(Boolean).join(" · ")}</p>
                  )}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vault root ──────────────────────────────────────────────────────────────
export default function ClientVault() {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    vaultVerify().then((ok) => {
      if (mounted) setAuthed(ok);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await vaultLogout();
    qc.removeQueries({ queryKey: ["vault"] });
    setOpenId(null);
    setAuthed(false);
  };

  if (authed === null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authed) {
    return <VaultLogin onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      {openId == null ? (
        <ClientList onOpen={setOpenId} onLogout={handleLogout} />
      ) : (
        <ClientDetail clientId={openId} onBack={() => setOpenId(null)} />
      )}
    </div>
  );
}
