import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, editorialApi, researchStaffApi, type LawyesReport, type LawyesReportState, type ResearchStaffSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, BookCheck, CheckCircle2, ExternalLink, FileDiff, FilePlus2, Link2, Loader2, RefreshCw, Search, ShieldCheck, Unlink } from "lucide-react";

const SECTION_KINDS = ["headnote", "facts", "procedural_history", "issues", "holdings", "ratio", "obiter", "orders_relief_costs", "legislation", "treated_authorities", "practice_notes"];
const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function StateBadge({ state }: { state: LawyesReportState }) {
  const colour = state === "Published" ? "bg-emerald-100 text-emerald-800" : state === "Lawyer reviewed" ? "bg-blue-100 text-blue-800" : state === "AI-assisted" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${colour}`}>{state}</span>;
}

export default function EditorialWorkbenchPage() {
  const { toast } = useToast();
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<LawyesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [judgmentId, setJudgmentId] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sectionKind, setSectionKind] = useState("headnote");
  const [heading, setHeading] = useState("");
  const [body, setBody] = useState("");
  const [proposition, setProposition] = useState("");
  const [pinpoints, setPinpoints] = useState<number[]>([]);
  const [staffSession, setStaffSession] = useState<ResearchStaffSession | null>(null);
  const [staffSessionChecked, setStaffSessionChecked] = useState(false);
  const [sourceChecked, setSourceChecked] = useState(false);
  const [pinpointsChecked, setPinpointsChecked] = useState(false);
  const [missingFieldsChecked, setMissingFieldsChecked] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ title: string; description: string } | null>(null);

  const load = useCallback(async (id = reportId) => {
    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed < 1) return;
    setLoading(true);
    try { setReport(await editorialApi.get(parsed)); setReportId(String(parsed)); setActionNotice(null); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setActionNotice({ title: "Admin session required", description: "Your password-admin session has expired. Sign in again before opening editorial reports." });
      } else {
        toast({ title: "Could not open report", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      }
    }
    finally { setLoading(false); }
  }, [reportId, toast]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("report");
    if (id) { setReportId(id); void load(id); }
  }, [load]);

  // The password session is deliberately separate from Clerk. Check whether a
  // second, attributable Clerk staff session is present before exposing legal
  // actions; the server remains the authority for both role and identity.
  useEffect(() => {
    void researchStaffApi.me()
      .then(setStaffSession)
      .catch(() => setStaffSession(null))
      .finally(() => setStaffSessionChecked(true));
  }, []);

  const unsupported = useMemo(() => report?.propositions.filter((item) => item.material && !report.pinpoints.some((pinpoint) => pinpoint.proposition_id === item.id)) ?? [], [report]);
  const latestReview = report?.reviews.at(-1);
  const canSignOff = staffSession?.role === "legal_reviewer" && !!staffSession.researchUserId;
  const canPublish = (staffSession?.role === "legal_reviewer" || staffSession?.role === "owner") && !!staffSession.researchUserId;
  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try { await action(); setActionNotice(null); }
    catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setActionNotice({
          title: "Clerk capability required",
          description: "This legal action requires an active Clerk legal-reviewer or owner session. The shared admin password cannot sign off or publish.",
        });
      } else if (error instanceof ApiError && error.status === 409) {
        setActionNotice({
          title: "No change was made",
          description: `${error.message} Review the current report and refresh before trying again; an existing report or a publication gate may be blocking this action.`,
        });
      } else {
        toast({ title: "Action could not be completed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      }
    }
    finally { setBusy(null); }
  };
  const create = () => run("create", async () => {
    const created = await editorialApi.create({ judgmentId: Number(judgmentId), title, sourceUrl });
    setReport(created); setReportId(String(created.id)); setCreateOpen(false);
    toast({ title: "Report access record created", description: "Source eligibility was checked by the research service." });
  });
  const materialize = () => run("paragraphs", async () => {
    const result = await editorialApi.materializeParagraphs(report!.id);
    toast({ title: "Verified paragraphs materialised", description: `${result.inserted} paragraph(s) added from immutable verified text.` });
    await load(String(report!.id));
  });
  const addSection = () => run("section", async () => {
    await editorialApi.addSection(report!.id, {
      kind: sectionKind, heading: heading || label(sectionKind), body,
      sortOrder: report!.sections.length,
      propositions: proposition.trim() ? [{ proposition, material: true, paragraphIds: pinpoints }] : [],
    });
    setHeading(""); setBody(""); setProposition(""); setPinpoints([]);
    toast({ title: "Structured section added", description: "Its proposition and pinpoint links were validated by the server." });
    await load(String(report!.id));
  });
  const signOff = () => run("review", async () => {
    if (!canSignOff || !staffSession?.researchUserId) {
      throw new Error("Sign in with Clerk as an active legal reviewer to record a legal sign-off. The shared admin password cannot sign off.");
    }
    await editorialApi.addReview(report!.id, { reviewerId: staffSession.researchUserId, decision: "approved", sourceChecked, pinpointsChecked, missingFieldsChecked, notes: reviewNotes || undefined });
    toast({ title: "Reviewer sign-off recorded", description: "The append-only review record is now part of the publication gate." });
    await load(String(report!.id));
  });
  const transition = (toState: LawyesReportState) => run(`transition-${toState}`, async () => {
    if (toState === "Published" && !canPublish) {
      throw new Error("Sign in with Clerk as an active legal reviewer or owner to publish. The shared admin password cannot publish.");
    }
    const updated = await editorialApi.transition(report!.id, toState, reason.trim() || `Editorial transition to ${toState}`);
    setReport((current) => current ? { ...current, ...updated } : current);
    setReason("");
    toast({ title: `Report moved to ${toState}`, description: "Server-side rights, review and pinpoint gates were enforced." });
    await load(String(report!.id));
  });

  return (
    <div className="mx-auto max-w-[1450px] space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">LAWYes editorial</p><h1 className="font-serif text-3xl font-bold">Report workbench</h1><p className="mt-1 text-sm text-muted-foreground">Original reporting from verified judgment text, with server-enforced publication gates.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setCreateOpen(!createOpen)}><FilePlus2 size={15} /> Create report</Button><Button variant="outline" onClick={() => load()} disabled={loading || !reportId}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</Button></div>
      </header>

      <form className="flex gap-2 rounded-xl border bg-card p-3 shadow-sm" onSubmit={(event) => { event.preventDefault(); void load(); }} role="search">
        <label className="relative flex-1"><span className="sr-only">Report ID</span><Search className="absolute left-3 top-2.5 text-muted-foreground" size={16} /><Input className="pl-9" inputMode="numeric" value={reportId} onChange={(event) => setReportId(event.target.value)} placeholder="Open report by ID" /></label><Button type="submit" disabled={loading}>Open workbench</Button>
      </form>

      {createOpen && <section className="rounded-xl border border-primary/30 bg-card p-5 shadow-sm"><h2 className="font-semibold">Create from verified judgment</h2><p className="mt-1 text-xs text-muted-foreground">Only a verified judgment with currently authorised source rights can create a report.</p><div className="mt-4 grid gap-3 md:grid-cols-3"><Input inputMode="numeric" value={judgmentId} onChange={(event) => setJudgmentId(event.target.value)} placeholder="Verified judgment ID" aria-label="Verified judgment ID" /><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Original report title" aria-label="Report title" /><Input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="Official or authorised source URL" aria-label="Source URL" /></div><div className="mt-3 flex justify-end"><Button onClick={create} disabled={busy === "create" || !judgmentId || !title || !sourceUrl}>{busy === "create" && <Loader2 size={14} className="animate-spin" />} Create report</Button></div></section>}

      {!report && !loading && <section className="rounded-xl border bg-card p-12 text-center shadow-sm"><BookCheck className="mx-auto mb-3 text-muted-foreground" size={34} /><p className="font-medium">Open a report to begin editorial work</p><p className="mt-1 text-sm text-muted-foreground">Use a report ID, or create an eligible report from a verified judgment.</p></section>}
      {loading && !report && <div className="flex justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={18} /> Opening report…</div>}
      {actionNotice && <section role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">{actionNotice.title}</p><p className="mt-1">{actionNotice.description}</p></section>}

      {report && <>
        <section className="flex flex-col justify-between gap-4 rounded-xl border bg-card p-5 shadow-sm lg:flex-row lg:items-center">
          <div><div className="mb-2 flex flex-wrap items-center gap-2"><StateBadge state={report.state} /><span className="text-xs text-muted-foreground">Report #{report.id} · Judgment #{report.judgment_id}</span></div><h2 className="font-serif text-2xl font-bold">{report.title}</h2><p className="mt-1 text-xs text-muted-foreground">Revision {report.current_revision} · updated {new Date(report.updated_at).toLocaleString("en-MY")}</p></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => transition(report.state === "Published" ? "Draft" : "AI-assisted")} disabled={!!busy}>{report.state === "Published" ? <Unlink size={14} /> : <FileDiff size={14} />}{report.state === "Published" ? "Unpublish to draft" : "Mark AI-assisted"}</Button>{report.state === "Lawyer reviewed" && <Button size="sm" onClick={() => transition("Published")} disabled={!!busy || !canPublish}><Link2 size={14} /> Publish</Button>}</div>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} className="text-emerald-600" /> Source verification</h2><p className="mt-1 text-sm">Verified at creation against the current rights record; this is re-checked on every review and publication transition.</p></div><a href={report.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">Open original source <ExternalLink size={14} /></a></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Verified at</dt><dd>{report.source_verified_at ? new Date(report.source_verified_at).toLocaleString("en-MY") : "Not verified"}</dd></div><div><dt className="text-xs text-muted-foreground">Rights record</dt><dd>{report.source_rights_record_id ?? "None"}</dd></div><div><dt className="text-xs text-muted-foreground">Paragraph corpus</dt><dd>{report.paragraphs.length} materialised verified paragraphs</dd></div></dl></section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold">Paragraph review corpus</h2><p className="mt-1 text-xs text-muted-foreground">Read-only text materialised exclusively from immutable verified extraction.</p></div><Button size="sm" onClick={materialize} disabled={busy === "paragraphs"}>{busy === "paragraphs" && <Loader2 size={13} className="animate-spin" />} Materialise paragraphs</Button></div><div className="max-h-[500px] divide-y overflow-y-auto">{report.paragraphs.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No paragraphs yet. Materialise the verified paragraph corpus first.</p> : report.paragraphs.map((paragraph) => <article id={`paragraph-${paragraph.id}`} key={paragraph.id} className="p-4"><span className="mr-2 rounded bg-slate-900 px-1.5 py-1 font-mono text-xs text-white">{paragraph.paragraph_key}</span><span className="text-[11px] text-muted-foreground">#{paragraph.ordinal}</span><p className="mt-3 whitespace-pre-wrap font-serif text-sm leading-6">{paragraph.text}</p></article>)}</div></section>
          <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Integrity inspection</h2><p className="mt-1 text-xs text-muted-foreground">Unsupported material propositions are calculated from the stored pinpoint links.</p>{unsupported.length ? <ul className="mt-4 space-y-2">{unsupported.map((item) => <li key={item.id} className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><AlertTriangle size={16} className="shrink-0" /><span><strong>{item.proposition}</strong><span className="mt-1 block text-xs">Material proposition without paragraph-level support. Publication will be refused.</span></span></li>)}</ul> : <p className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> All material propositions have pinpoint support.</p>}<div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><strong>Missing source fields:</strong> this backend retains editorial section text only. Record absent facts explicitly as “Not stated in the published judgment” in the relevant section; never infer them.</div></section>
        </div>

        <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Add structured report section</h2><p className="mt-1 text-xs text-muted-foreground">Sections are append-only editorial records. Attach a material proposition only with its supporting verified paragraph(s).</p><div className="mt-4 grid gap-3 md:grid-cols-2"><select value={sectionKind} onChange={(event) => setSectionKind(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="">Choose section type</option>{SECTION_KINDS.map((kind) => <option key={kind} value={kind}>{label(kind)}</option>)}</select><Input value={heading} onChange={(event) => setHeading(event.target.value)} placeholder={`Heading (defaults to ${label(sectionKind)})`} /><Textarea className="md:col-span-2 font-serif leading-6" rows={6} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Original editorial text. Use “Not stated in the published judgment” for an absent source fact." /><Input className="md:col-span-2" value={proposition} onChange={(event) => setProposition(event.target.value)} placeholder="Material proposition (optional; requires pinpoint support)" /></div>
          {proposition && <fieldset className="mt-4"><legend className="text-xs font-semibold">Supporting paragraph pinpoints</legend><div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">{report.paragraphs.map((paragraph) => <label key={paragraph.id} className={`cursor-pointer rounded border px-2 py-1 text-xs ${pinpoints.includes(paragraph.id) ? "border-primary bg-primary/10" : ""}`}><Checkbox className="mr-1.5 align-middle" checked={pinpoints.includes(paragraph.id)} onCheckedChange={() => setPinpoints((current) => current.includes(paragraph.id) ? current.filter((id) => id !== paragraph.id) : [...current, paragraph.id])} />{paragraph.paragraph_key}</label>)}</div></fieldset>}
          <div className="mt-4 flex justify-end"><Button onClick={addSection} disabled={busy === "section" || !sectionKind || !body.trim() || (!!proposition.trim() && !pinpoints.length)}>{busy === "section" && <Loader2 size={14} className="animate-spin" />} Add section</Button></div>
          <div className="mt-5 divide-y border-t">{report.sections.map((section) => <article key={section.id} className="py-4"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label(section.kind)}</p><h3 className="mt-1 font-serif font-bold">{section.heading}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{section.body}</p></article>)}{!report.sections.length && <p className="py-5 text-sm text-muted-foreground">No report sections recorded.</p>}</div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold"><BookCheck size={18} /> Reviewer sign-off</h2>{latestReview ? <div className="mt-4 rounded-lg bg-muted p-3 text-sm"><p className="font-semibold">{latestReview.decision === "approved" ? "Approved review" : "Changes requested"}</p><p className="mt-1 text-xs text-muted-foreground">Reviewer #{latestReview.reviewer_id} · {new Date(latestReview.created_at).toLocaleString("en-MY")}</p>{latestReview.notes && <p className="mt-2 text-xs">{latestReview.notes}</p>}</div> : <><p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">{!staffSessionChecked ? "Checking Clerk legal-reviewer session…" : canSignOff ? `Clerk legal reviewer identity confirmed (reviewer #${staffSession!.researchUserId}).` : "The shared admin password cannot sign off. Sign in with Clerk as an active legal reviewer, then refresh this page."}</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 text-xs"><Checkbox checked={sourceChecked} onCheckedChange={(value) => setSourceChecked(value === true)} /> Source checked</label><label className="flex items-center gap-2 text-xs"><Checkbox checked={pinpointsChecked} onCheckedChange={(value) => setPinpointsChecked(value === true)} /> Pinpoints checked</label></div><label className="mt-2 flex items-center gap-2 text-xs"><Checkbox checked={missingFieldsChecked} onCheckedChange={(value) => setMissingFieldsChecked(value === true)} /> Missing fields checked</label><Textarea className="mt-3" rows={2} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Reviewer notes (optional)" /><Button className="mt-3" onClick={signOff} disabled={busy === "review" || !canSignOff || !sourceChecked || !pinpointsChecked || !missingFieldsChecked}>{busy === "review" && <Loader2 size={14} className="animate-spin" />} Record legal reviewer sign-off</Button></>}</section>
          <section className="rounded-xl border bg-card p-5 shadow-sm"><h2 className="flex items-center gap-2 font-semibold"><FileDiff size={18} /> Revision & state history</h2><p className="mt-1 text-xs text-muted-foreground">The API records immutable transition snapshots. Content-level diff is not exposed by the backend.</p><ul className="mt-4 space-y-3">{report.revisions.map((revision) => <li key={revision.id} className="border-l-2 border-primary pl-3 text-sm"><p className="font-semibold">v{revision.revision}: {revision.from_state ?? "Created"} → {revision.to_state}</p><p className="mt-0.5 text-xs text-muted-foreground">{revision.reason} · {revision.actor} · {new Date(revision.created_at).toLocaleString("en-MY")}</p></li>)}{!report.revisions.length && <li className="text-sm text-muted-foreground">No revisions returned.</li>}</ul><Textarea className="mt-4" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for next state transition (recommended)" /></section>
        </div>
        {report.state !== "Lawyer reviewed" && report.state !== "Published" && <div className="flex flex-col items-end gap-2"><p className="text-xs text-muted-foreground">{canPublish ? "This Clerk staff session may record the legal-review state." : "A Clerk legal reviewer or owner session is required for legal-review and publication state changes."}</p><Button onClick={() => transition("Lawyer reviewed")} disabled={!!busy || !canPublish || !latestReview || latestReview.decision !== "approved"}>Move to lawyer reviewed</Button></div>}
      </>}
    </div>
  );
}