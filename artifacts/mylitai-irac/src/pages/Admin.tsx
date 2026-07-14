import { useEffect, useState } from "react";
import {
  ShieldCheck,
  Loader2,
  CircleAlert,
  KeyRound,
  Copy,
  Check,
  Ban,
  RotateCcw,
  Mail,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminVerify,
  listAccessCodes,
  generateAccessCodes,
  revokeAccessCode,
  restoreAccessCode,
  getAdminAiProvider,
  setAdminAiProvider,
  type AccessCode,
  type AIProvider,
} from "@/lib/irac-api";
import { UserRound } from "lucide-react";
import { PARALEGALS } from "@/lib/paralegals";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);

  const [form, setForm] = useState({
    recipientName: "",
    recipientEmail: "",
    notes: "",
    expiresAt: "",
    count: 1,
  });
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{
    codes: string[];
    emailSent: boolean;
    emailError?: string;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [aiProvider, setAiProvider] = useState<AIProvider>("gemini");
  const [openaiAvailable, setOpenaiAvailable] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);

  const saveProvider = async (next: AIProvider) => {
    setAiBusy(true);
    setAiErr(null);
    setAiMsg(null);
    try {
      const saved = await setAdminAiProvider(password, next);
      setAiProvider(saved);
      setAiMsg(`Default paralegal set to ${PARALEGALS[saved].name}.`);
    } catch (ex) {
      setAiErr((ex as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const refresh = async (pw: string) => {
    setLoading(true);
    setListErr(null);
    try {
      setCodes(await listAccessCodes(pw));
    } catch (e) {
      setListErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) {
      void refresh(password);
      getAdminAiProvider()
        .then((s) => {
          setAiProvider(s.provider);
          setOpenaiAvailable(s.openaiConfigured);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setAuthBusy(true);
    setAuthErr(null);
    const ok = await adminVerify(password.trim());
    setAuthBusy(false);
    if (ok) setAuthed(true);
    else setAuthErr("Incorrect password.");
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName.trim() || !form.recipientEmail.trim()) return;
    setGenBusy(true);
    setGenErr(null);
    setGenResult(null);
    try {
      const res = await generateAccessCodes(password, {
        recipientName: form.recipientName.trim(),
        recipientEmail: form.recipientEmail.trim(),
        notes: form.notes.trim() || undefined,
        expiresAt: form.expiresAt || undefined,
        count: Math.max(1, Number(form.count) || 1),
      });
      setGenResult({ codes: res.codes, emailSent: res.emailSent, emailError: res.emailError });
      setForm({ recipientName: "", recipientEmail: "", notes: "", expiresAt: "", count: 1 });
      await refresh(password);
    } catch (ex) {
      setGenErr((ex as Error).message);
    } finally {
      setGenBusy(false);
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggle = async (c: AccessCode) => {
    try {
      if (c.status === "revoked") await restoreAccessCode(password, c.id);
      else await revokeAccessCode(password, c.id);
      await refresh(password);
    } catch (ex) {
      setListErr((ex as Error).message);
    }
  };

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 w-full">
        <Card>
          <CardContent className="p-8 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-[hsl(var(--gold-bright))]" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-semibold text-foreground">Administration</h2>
                <p className="text-xs text-muted-foreground">Access-code management</p>
              </div>
            </div>
            <form onSubmit={signIn} className="space-y-3">
              <div>
                <Label>Admin password</Label>
                <Input
                  className="mt-1"
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {authErr && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {authErr}
                </div>
              )}
              <Button type="submit" disabled={authBusy || !password.trim()} className="w-full gap-2">
                {authBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">Administration</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Generate and manage access codes. New codes can be emailed automatically to the recipient.
        </p>
        <div className="rule-gold mt-4" />
      </div>

      {/* Default paralegal */}
      <Card className="mb-6">
        <CardContent className="p-6 space-y-4">
          <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
            <UserRound className="h-5 w-5 text-primary" /> Default paralegal
          </h2>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Sets the paralegal used by default across all IRAC tools (research, drafting,
            analysis, affidavits, appeals, oral practice, enforcement). Each practitioner can
            still pick a different paralegal for their own browser. This does not affect the
            banking-litigation platform.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {(["openai", "gemini"] as const).map((p) => {
              const meta = PARALEGALS[p];
              const disabled = aiBusy || (p === "openai" && !openaiAvailable);
              const active = aiProvider === p;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => saveProvider(p)}
                  className={`text-left rounded-lg border p-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? "border-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)]"
                      : "border-border hover:border-[hsl(var(--gold)/0.5)]"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <UserRound className="h-4 w-4 text-[hsl(var(--gold-bright))]" />
                    {meta.name}
                    <span className="text-xs font-normal text-muted-foreground">· {meta.role}</span>
                    {active && (
                      <span className="ml-auto text-xs text-[hsl(var(--gold-bright))]">Active</span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-2">
                    <span className="text-[hsl(var(--gold-bright))]/80">Strengths:</span>{" "}
                    {meta.strengths}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">
                    <span className="text-foreground/70">Trade-offs:</span> {meta.weaknesses}
                  </span>
                  {p === "openai" && !openaiAvailable && (
                    <span className="block text-xs italic text-muted-foreground mt-2">
                      Currently unavailable.
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {aiMsg && <p className="text-sm text-[hsl(var(--gold-bright))]">{aiMsg}</p>}
          {aiErr && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <CircleAlert className="h-4 w-4" /> {aiErr}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Generate */}
        <Card className="self-start">
          <CardContent className="p-6 space-y-4">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
              <KeyRound className="h-5 w-5 text-primary" /> Generate codes
            </h2>
            <form onSubmit={generate} className="space-y-3">
              <div>
                <Label>Recipient name</Label>
                <Input
                  className="mt-1"
                  value={form.recipientName}
                  onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
                />
              </div>
              <div>
                <Label>Recipient email</Label>
                <Input
                  className="mt-1"
                  type="email"
                  value={form.recipientEmail}
                  onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Count</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    max={50}
                    value={form.count}
                    onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Expires (optional)</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button
                type="submit"
                disabled={genBusy || !form.recipientName.trim() || !form.recipientEmail.trim()}
                className="w-full gap-2"
              >
                {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate
              </Button>
            </form>

            {genErr && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4" />
                {genErr}
              </div>
            )}

            {genResult && (
              <div className="rounded-md border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.06)] p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--gold-bright))]">
                  <Check className="h-3.5 w-3.5" /> {genResult.codes.length} code(s) generated
                </p>
                <div className="space-y-1">
                  {genResult.codes.map((c) => (
                    <button
                      key={c}
                      onClick={() => copy(c)}
                      className="w-full flex items-center justify-between gap-2 font-mono text-sm bg-background/60 border border-border rounded px-2 py-1.5 hover:border-[hsl(var(--gold)/0.5)]"
                    >
                      <span>{c}</span>
                      {copied === c ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {genResult.emailSent
                    ? "Emailed to the recipient."
                    : `Email not sent${genResult.emailError ? `: ${genResult.emailError}` : "."}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* List */}
        <div>
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          )}
          {listErr && (
            <div className="flex items-center gap-2 text-destructive py-4">
              <CircleAlert className="h-5 w-5" /> {listErr}
            </div>
          )}
          {!loading && codes.length === 0 && !listErr && (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No access codes yet.
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {codes.map((c) => (
              <Card key={c.id} className={c.status === "revoked" ? "opacity-60" : undefined}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => copy(c.code)}
                        className="font-mono text-sm text-foreground hover:text-[hsl(var(--gold-bright))] flex items-center gap-1.5"
                      >
                        {c.code}
                        {copied === c.code ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          c.status === "revoked"
                            ? "border-rose-500/40 text-rose-400"
                            : "border-emerald-500/40 text-emerald-400"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.recipientName} · {c.recipientEmail}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Used {c.usageCount}×
                      {c.expiresAt ? ` · expires ${new Date(c.expiresAt).toLocaleDateString("en-MY")}` : ""}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    onClick={() => toggle(c)}
                  >
                    {c.status === "revoked" ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </>
                    ) : (
                      <>
                        <Ban className="h-3.5 w-3.5" /> Revoke
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
