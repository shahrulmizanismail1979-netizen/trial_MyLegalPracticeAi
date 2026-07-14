import { useState } from 'react';
import {
  useIntakeRecords,
  useConflictCheck,
  useCreateIntake,
  useDeleteIntake,
  RISK_META,
  CONFLICT_META,
  STATUS_META,
  type IntakeInput,
  type ConflictResult,
} from '@/hooks/use-intake';
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Input,
  Label,
  Select,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Loader2,
  UserCheck,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FileWarning,
} from 'lucide-react';

const EMPTY: IntakeInput = {
  clientName: '',
  clientType: 'individual',
  idNumber: '',
  contact: '',
  actingFor: 'Plaintiff',
  matterDescription: '',
  adverseParties: '',
  sourceOfFunds: '',
  pep: 'no',
  riskRating: 'low',
  amlaNotes: '',
  notes: '',
  status: 'pending',
};

const ACTING_FOR = ['Plaintiff', 'Defendant', 'Applicant', 'Respondent', 'Petitioner'];

function meta<T extends { label: string; color: string }>(map: Record<string, T>, k: string): T {
  return map[k] ?? Object.values(map)[0];
}

export default function Compliance() {
  const { data: records, isLoading } = useIntakeRecords();
  const conflictCheck = useConflictCheck();
  const createIntake = useCreateIntake();
  const deleteIntake = useDeleteIntake();
  const { toast } = useToast();

  const [form, setForm] = useState<IntakeInput>(EMPTY);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);

  const set = (k: keyof IntakeInput, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Any change to screened names invalidates a prior conflict result.
    if (k === 'clientName' || k === 'adverseParties') setConflict(null);
  };

  const runConflict = async () => {
    if (!form.clientName?.trim()) {
      toast({ title: 'Client name required', description: 'Enter the client name before screening.', variant: 'destructive' });
      return;
    }
    try {
      const result = await conflictCheck.mutateAsync({
        clientName: form.clientName,
        adverseParties: form.adverseParties || undefined,
      });
      setConflict(result);
      toast({
        title: result.status === 'clear' ? 'No conflicts found' : 'Potential conflict',
        description: result.status === 'clear'
          ? 'No matches against your existing matters or intakes.'
          : `${result.matches.length} possible match(es) — review before acting.`,
        variant: result.status === 'clear' ? undefined : 'destructive',
      });
    } catch (e) {
      toast({ title: 'Conflict check failed', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const save = async (status: string) => {
    if (!form.clientName?.trim()) {
      toast({ title: 'Client name required', variant: 'destructive' });
      return;
    }
    try {
      await createIntake.mutateAsync({
        ...form,
        status,
        conflictStatus: conflict ? conflict.status : 'not-run',
        conflictMatches: conflict ? conflict.matches : null,
      });
      toast({ title: 'Intake saved', description: `“${form.clientName}” recorded${status === 'cleared' ? ' and cleared to act' : ''}.` });
      setForm(EMPTY);
      setConflict(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: msg.includes('subscription') ? 'Premium feature' : 'Could not save intake', description: msg, variant: 'destructive' });
    }
  };

  const list = records ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <PageHeader
        title="Client Intake & Compliance"
        description="Onboard a new client the right way: screen for conflicts against your existing matters, record the AMLA risk assessment, and keep an auditable intake file before you agree to act."
      />

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Intake form */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" /> Prospective client</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Client name *</Label>
                  <Input value={form.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} placeholder="e.g. Tan Sri Ahmad bin Ali / ABC Sdn Bhd" />
                </div>
                <div className="space-y-1.5">
                  <Label>Client type</Label>
                  <Select value={form.clientType ?? 'individual'} onChange={(e) => set('clientType', e.target.value)}>
                    <option value="individual">Individual</option>
                    <option value="company">Company</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{form.clientType === 'company' ? 'Company reg. no.' : 'NRIC / Passport'}</Label>
                  <Input value={form.idNumber ?? ''} onChange={(e) => set('idNumber', e.target.value)} placeholder={form.clientType === 'company' ? 'e.g. 202301012345' : 'e.g. 800101-14-5555'} />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact</Label>
                  <Input value={form.contact ?? ''} onChange={(e) => set('contact', e.target.value)} placeholder="Phone / email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Acting for</Label>
                  <Select value={form.actingFor ?? ''} onChange={(e) => set('actingFor', e.target.value)}>
                    {ACTING_FOR.map((a) => <option key={a} value={a}>{a}</option>)}
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Proposed matter</Label>
                <Textarea rows={2} value={form.matterDescription ?? ''} onChange={(e) => set('matterDescription', e.target.value)} placeholder="Nature of the retainer / dispute" />
              </div>
              <div className="space-y-1.5">
                <Label>Adverse &amp; connected parties (one per line)</Label>
                <Textarea rows={3} value={form.adverseParties ?? ''} onChange={(e) => set('adverseParties', e.target.value)} placeholder={'Opposing party\nGuarantor\nConnected company…'} />
                <p className="text-[11px] text-muted-foreground">These names are screened against your existing matters and prior intakes.</p>
              </div>
            </CardContent>
          </Card>

          {/* AMLA */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><FileWarning className="h-5 w-5 text-primary" /> AMLA risk assessment</h3>
              <p className="text-xs text-muted-foreground -mt-2">Customer due diligence under the Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act 2001 (AMLA). Record your assessment before accepting the retainer.</p>
              <div className="space-y-1.5">
                <Label>Source of funds</Label>
                <Input value={form.sourceOfFunds ?? ''} onChange={(e) => set('sourceOfFunds', e.target.value)} placeholder="e.g. business income, financing facility, sale proceeds" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Politically exposed person?</Label>
                  <Select value={form.pep ?? 'no'} onChange={(e) => set('pep', e.target.value)}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                    <option value="unknown">Unknown</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Overall risk rating</Label>
                  <Select value={form.riskRating ?? 'low'} onChange={(e) => set('riskRating', e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>CDD notes</Label>
                <Textarea rows={2} value={form.amlaNotes ?? ''} onChange={(e) => set('amlaNotes', e.target.value)} placeholder="Identity verification done, documents sighted, any red flags…" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Conflict + actions */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="sticky top-4">
            <CardContent className="p-5 space-y-4">
              <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Conflict screen</h3>
              <Button className="w-full gap-2" variant="outline" onClick={runConflict} disabled={conflictCheck.isPending}>
                {conflictCheck.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Screening…</> : <><Search className="h-4 w-4" /> Run conflict check</>}
              </Button>

              {conflict && (
                <div className={`rounded-lg border p-3 ${conflict.status === 'clear' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-amber-500/20 bg-amber-500/5'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {conflict.status === 'clear'
                      ? <><CheckCircle2 className="h-4 w-4 text-emerald-400" /><span className="text-sm font-semibold text-emerald-400">No conflict found</span></>
                      : <><ShieldAlert className="h-4 w-4 text-amber-400" /><span className="text-sm font-semibold text-amber-400">{conflict.matches.length} potential match(es)</span></>}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">Screened: {conflict.screened.join(', ') || '—'}</p>
                  {conflict.matches.length > 0 && (
                    <ul className="space-y-1.5">
                      {conflict.matches.map((m, i) => (
                        <li key={i} className="text-xs text-foreground/90 border-l-2 border-amber-500/40 pl-2">
                          <span className="font-medium">{m.name}</span> <span className="text-muted-foreground">({m.role})</span>
                          <div className="text-[11px] text-muted-foreground">matches “{m.matchedAgainst}”{m.reference ? ` · ${m.reference}` : ''}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="border-t border-border pt-4 space-y-2">
                <p className="text-xs text-muted-foreground">Once you have screened and assessed risk, record the intake:</p>
                <Button className="w-full gap-2" onClick={() => save('cleared')} disabled={createIntake.isPending}>
                  <ShieldCheck className="h-4 w-4" /> Save &amp; clear to act
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => save('pending')} disabled={createIntake.isPending}>Save as pending</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => save('declined')} disabled={createIntake.isPending}>Decline</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Records */}
      <div className="mt-8">
        <h2 className="font-serif text-xl font-bold text-foreground mb-4">Intake records</h2>
        {isLoading ? (
          <div className="p-8 text-center text-primary animate-pulse">Loading records…</div>
        ) : list.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No intake records yet. Complete the form above to create your first compliance file.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {list.map((r) => {
              const risk = meta(RISK_META, r.riskRating);
              const conf = meta(CONFLICT_META, r.conflictStatus);
              const st = meta(STATUS_META, r.status);
              return (
                <Card key={r.id}>
                  <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{r.clientName}</h3>
                        <span className="text-[10px] text-muted-foreground">{r.clientType === 'company' ? 'Company' : 'Individual'}{r.actingFor ? ` · ${r.actingFor}` : ''}</span>
                      </div>
                      {r.matterDescription && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.matterDescription}</p>}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.color}`}>{st.label}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${conf.color}`}>{conf.label}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${risk.color}`}>{risk.label}</span>
                        {r.pep === 'yes' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border text-red-400 bg-red-500/10 border-red-500/20"><AlertTriangle className="h-3 w-3" /> PEP</span>}
                      </div>
                      {Array.isArray(r.conflictMatches) && r.conflictMatches.length > 0 && (
                        <p className="text-[11px] text-amber-400/90 mt-2">{r.conflictMatches.length} conflict match(es) recorded — see file.</p>
                      )}
                    </div>
                    <button onClick={() => deleteIntake.mutate(r.id)} className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
