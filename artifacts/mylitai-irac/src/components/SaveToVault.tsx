import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FolderLock,
  Lock,
  Loader2,
  ShieldCheck,
  Check,
  FileText,
  CircleAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  vaultVerify,
  vaultLogin,
  listVaultClients,
  createVaultClient,
  saveWorkToVault,
  uploadVaultDocument,
  type VaultClient,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))] mt-1";

interface SaveToVaultProps {
  /** Stored on the saved_work row (shown as a small badge in the vault). */
  kind: string;
  /** Human label for the summary, e.g. "The generated draft". */
  workLabel: string;
  /** Pre-filled, editable title for the saved work. */
  defaultTitle: string;
  /** The generated markdown to persist. */
  content: string;
  /** Original source files to also file under the client. */
  sourceFiles?: File[];
  disabled?: boolean;
}

export function SaveToVault({
  kind,
  workLabel,
  defaultTitle,
  content,
  sourceFiles = [],
  disabled,
}: SaveToVaultProps) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"checking" | "login" | "pick">("checking");
  const [passcode, setPasscode] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clients, setClients] = useState<VaultClient[]>([]);
  const [clientId, setClientId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [progress, setProgress] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const fileCount = sourceFiles.length;

  const loadClients = async () => {
    try {
      const list = await listVaultClients();
      setClients(list);
      setClientId(list.length ? String(list[0].id) : "__new__");
    } catch {
      setClientId("__new__");
    }
  };

  const openDialog = async () => {
    setOpen(true);
    setDone(false);
    setProgress(null);
    setNewName("");
    setTitle(defaultTitle);
    setPhase("checking");
    const ok = await vaultVerify();
    if (ok) {
      setPhase("pick");
      await loadClients();
    } else {
      setPhase("login");
    }
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim()) return;
    setBusy(true);
    setLoginErr(null);
    try {
      await vaultLogin(passcode.trim());
      setPasscode("");
      setPhase("pick");
      await loadClients();
    } catch (err) {
      setLoginErr((err as Error).message || t("save.login.invalid"));
    } finally {
      setBusy(false);
    }
  };

  const friendlyError = (msg: string) =>
    msg === "SUBSCRIPTION_REQUIRED"
      ? t("save.premium")
      : msg === "AUTH_REQUIRED"
        ? t("save.login.invalid")
        : msg;

  const handleSave = async () => {
    setBusy(true);
    setProgress(null);
    try {
      let cid: number;
      if (clientId === "__new__") {
        if (!newName.trim()) {
          toast({ title: t("save.needName"), variant: "destructive" });
          setBusy(false);
          return;
        }
        const created = await createVaultClient({ name: newName.trim() });
        cid = created.id;
      } else {
        cid = Number(clientId);
      }

      setProgress(t("save.progress.work"));
      await saveWorkToVault({
        kind,
        title: title.trim() || defaultTitle,
        content,
        clientId: cid,
      });

      let okFiles = 0;
      let failFiles = 0;
      for (let i = 0; i < sourceFiles.length; i++) {
        setProgress(`${t("save.progress.files")} (${i + 1}/${sourceFiles.length})`);
        try {
          await uploadVaultDocument(cid, sourceFiles[i]);
          okFiles++;
        } catch {
          failFiles++;
        }
      }

      setDone(true);
      toast({
        title: t("save.success"),
        description: failFiles
          ? `${t("save.success.partial")} (${okFiles}/${sourceFiles.length})`
          : fileCount
            ? `${t("save.success.withFiles")} ${okFiles}`
            : t("save.success.workOnly"),
      });
      setTimeout(() => setOpen(false), 900);
    } catch (err) {
      toast({
        title: t("save.failed"),
        description: friendlyError((err as Error).message),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={openDialog}
        className="gap-2 border-[hsl(var(--gold))]/40 hover:border-[hsl(var(--gold))]/70"
      >
        <FolderLock className="w-4 h-4 text-[hsl(var(--gold-bright))]" />
        {t("save.button")}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif flex items-center gap-2">
              <FolderLock className="w-5 h-5 text-[hsl(var(--gold-bright))]" />
              {t("save.title")}
            </DialogTitle>
          </DialogHeader>

          {phase === "checking" && (
            <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
            </div>
          )}

          {phase === "login" && (
            <form onSubmit={submitLogin} className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" /> {t("save.login.desc")}
              </p>
              <div>
                <Label>{t("vault.login.passcode")}</Label>
                <Input
                  type="password"
                  className="mt-1"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                />
              </div>
              {loginErr && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" /> {loginErr}
                </div>
              )}
              <Button type="submit" disabled={busy} className="w-full gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {t("vault.login.button")}
              </Button>
            </form>
          )}

          {phase === "pick" && (
            <div className="space-y-4 py-2">
              <div>
                <Label>{t("save.field.title")}</Label>
                <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div>
                <Label>{t("save.field.client")}</Label>
                <select
                  className={selectCls}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={busy}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.reference ? ` · ${c.reference}` : ""}
                    </option>
                  ))}
                  <option value="__new__">＋ {t("save.newClient")}</option>
                </select>
              </div>

              {clientId === "__new__" && (
                <div>
                  <Label>{t("vault.form.name")}</Label>
                  <Input
                    className="mt-1"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("vault.form.namePlaceholder")}
                    autoFocus
                  />
                </div>
              )}

              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1.5">
                <p className="font-medium text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> {t("save.summary")}
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>{workLabel}</li>
                  {fileCount > 0 ? (
                    <li>
                      {fileCount} {fileCount !== 1 ? t("save.sourceFiles") : t("save.sourceFile")}
                    </li>
                  ) : (
                    <li className="italic">{t("save.noFiles")}</li>
                  )}
                </ul>
                {fileCount > 0 && (
                  <p className="text-[11px] text-muted-foreground/80 italic pt-0.5">{t("save.filesHint")}</p>
                )}
              </div>

              {progress && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress}
                </div>
              )}

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleSave} disabled={busy || done} className="gap-2">
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderLock className="h-4 w-4" />
                  )}
                  {done ? t("save.saved") : t("save.confirm")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
