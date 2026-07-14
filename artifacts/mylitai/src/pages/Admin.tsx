import { useState, useEffect } from 'react';
import { Scale, Shield, Plus, Copy, Ban, RefreshCw, Check, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

interface AccessCode {
  id: number;
  code: string;
  recipientName: string;
  recipientEmail: string;
  notes: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-900/40 text-green-400 border border-green-700/50',
    revoked: 'bg-red-900/40 text-red-400 border border-red-700/50',
    expired: 'bg-yellow-900/40 text-yellow-400 border border-yellow-700/50',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || styles.expired}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title="Copy code" className="text-primary hover:text-primary/80 transition-colors">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export default function Admin() {
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPw, setShowAdminPw] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [form, setForm] = useState({
    recipientName: '',
    recipientEmail: '',
    notes: '',
    expiresAt: '',
    count: 1,
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; error?: string } | null>(null);

  const adminHeaders = { 'Content-Type': 'application/json', 'x-admin-password': adminPassword };

  const verifyAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/lit/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setAuthed(true);
        loadCodes();
      } else {
        setAuthError('Incorrect admin password.');
      }
    } catch {
      setAuthError('Network error. Please try again.');
    }
    setAuthLoading(false);
  };

  const loadCodes = async () => {
    setLoadingCodes(true);
    try {
      const res = await fetch('/api/lit/admin/codes', { headers: { 'x-admin-password': adminPassword } });
      if (res.ok) {
        setCodes(await res.json());
      }
    } catch {}
    setLoadingCodes(false);
  };

  const generateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setGeneratedCodes([]);
    setEmailStatus(null);
    if (!form.recipientName.trim()) return setFormError('Recipient name is required.');
    if (!form.recipientEmail.trim() || !form.recipientEmail.includes('@')) return setFormError('A valid email address is required.');
    setFormLoading(true);
    try {
      const res = await fetch('/api/lit/admin/codes/generate', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          recipientName: form.recipientName,
          recipientEmail: form.recipientEmail,
          notes: form.notes,
          expiresAt: form.expiresAt || undefined,
          count: form.count,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedCodes(data.codes);
        setEmailStatus({ sent: data.emailSent, error: data.emailError });
        setForm({ recipientName: '', recipientEmail: '', notes: '', expiresAt: '', count: 1 });
        loadCodes();
      } else {
        setFormError(data.error || 'Failed to generate codes.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    }
    setFormLoading(false);
  };

  const revokeCode = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/lit/admin/codes/revoke', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ id }),
      });
      if (res.ok) loadCodes();
    } catch {}
    setActionLoading(null);
  };

  const restoreCode = async (id: number) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/lit/admin/codes/restore', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ id }),
      });
      if (res.ok) loadCodes();
    } catch {}
    setActionLoading(null);
  };

  useEffect(() => {
    if (authed) loadCodes();
  }, [authed]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-[#1e293b] border-2 border-[#d4a017] rounded-2xl flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-[#d4a017]" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-white">Admin Panel</h1>
            <p className="text-slate-400 mt-1 text-sm">MyLitAi — Restricted Access</p>
          </div>
          <Card className="border-[#d4a017]/20 bg-[#1e293b]">
            <CardContent className="p-6">
              <form onSubmit={verifyAdmin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-300">Admin Password</label>
                  <div className="relative">
                    <Input
                      type={showAdminPw ? 'text' : 'password'}
                      placeholder="Enter admin password"
                      value={adminPassword}
                      onChange={e => setAdminPassword(e.target.value)}
                      autoFocus
                      className="h-11 bg-[#0f172a] border-slate-600 text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showAdminPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {authError && <p className="text-sm text-red-400">{authError}</p>}
                </div>
                <Button type="submit" className="w-full bg-[#d4a017] text-[#0f172a] hover:bg-[#b8891a] font-semibold" disabled={authLoading}>
                  {authLoading ? 'Verifying...' : 'Enter Admin Panel'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-[#1e293b] border border-[#d4a017]/40 rounded-xl flex items-center justify-center">
              <Scale className="h-5 w-5 text-[#d4a017]" />
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-white">MyLitAi Admin</h1>
              <p className="text-xs text-slate-400">Access Code Management</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadCodes} disabled={loadingCodes} className="border-slate-600 text-slate-300 hover:text-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingCodes ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card className="bg-[#1e293b] border-[#d4a017]/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#d4a017] flex items-center gap-2 text-base font-serif">
              <Plus className="h-4 w-4" /> Generate New Access Code(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={generateCodes} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Recipient Name <span className="text-red-400">*</span></label>
                  <Input
                    placeholder="e.g. Ahmad bin Abdullah"
                    value={form.recipientName}
                    onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                    className="bg-[#0f172a] border-slate-600 text-white h-10"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Recipient Email <span className="text-red-400">*</span></label>
                  <Input
                    type="email"
                    placeholder="e.g. ahmad@lawfirm.com.my"
                    value={form.recipientEmail}
                    onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
                    className="bg-[#0f172a] border-slate-600 text-white h-10"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Notes (optional)</label>
                  <Input
                    placeholder="e.g. Annual subscription, paid via TnG"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="bg-[#0f172a] border-slate-600 text-white h-10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Expiry Date (optional)</label>
                  <Input
                    type="date"
                    value={form.expiresAt}
                    onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                    className="bg-[#0f172a] border-slate-600 text-white h-10"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Number of Codes (1–50)</label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.count}
                    onChange={e => setForm(f => ({ ...f, count: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                    className="bg-[#0f172a] border-slate-600 text-white h-10 w-32"
                  />
                </div>
              </div>
              {formError && <p className="text-sm text-red-400">{formError}</p>}
              <Button type="submit" disabled={formLoading} className="bg-[#d4a017] text-[#0f172a] hover:bg-[#b8891a] font-semibold">
                <Plus className="h-4 w-4 mr-2" />
                {formLoading ? 'Generating...' : `Generate ${form.count > 1 ? `${form.count} Codes` : 'Code'}`}
              </Button>
            </form>

            {generatedCodes.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-lg">
                  <p className="text-sm font-medium text-green-400 mb-3">
                    {generatedCodes.length === 1 ? '1 code generated' : `${generatedCodes.length} codes generated`} — copy and share with recipient:
                  </p>
                  <div className="space-y-2">
                    {generatedCodes.map(c => (
                      <div key={c} className="flex items-center gap-3 bg-[#0f172a] rounded px-3 py-2">
                        <code className="font-mono text-[#d4a017] font-bold tracking-wider text-sm flex-1">{c}</code>
                        <CopyButton text={c} />
                      </div>
                    ))}
                  </div>
                </div>
                {emailStatus && (
                  emailStatus.sent ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-blue-900/20 border border-blue-700/40 rounded-lg text-sm text-blue-300">
                      <Check className="h-4 w-4 text-blue-400 shrink-0" />
                      Email sent successfully to recipient's inbox.
                    </div>
                  ) : (
                    <div className="px-4 py-3 bg-yellow-900/20 border border-yellow-700/40 rounded-lg text-sm text-yellow-400">
                      Email could not be sent automatically{emailStatus.error ? `: ${emailStatus.error}` : ''}. Please share the code manually.
                    </div>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b] border-[#d4a017]/20">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#d4a017] text-base font-serif">
              All Access Codes ({codes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCodes ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-[#d4a017]" />
              </div>
            ) : codes.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No access codes yet. Generate your first code above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Code</th>
                      <th className="text-left py-2 pr-4">Recipient</th>
                      <th className="text-left py-2 pr-4">Email</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Created</th>
                      <th className="text-left py-2 pr-4">Expires</th>
                      <th className="text-left py-2 pr-4">Last Used</th>
                      <th className="text-left py-2 pr-4">Uses</th>
                      <th className="text-left py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {codes.map(c => (
                      <tr key={c.id} className="border-b border-slate-800 hover:bg-[#0f172a]/40 transition-colors">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-[#d4a017] text-xs tracking-wider">{c.code}</code>
                            <CopyButton text={c.code} />
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-slate-200 whitespace-nowrap">{c.recipientName}</td>
                        <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">{c.recipientEmail}</td>
                        <td className="py-2 pr-4"><StatusBadge status={c.status} /></td>
                        <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                        <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">{fmtDate(c.expiresAt)}</td>
                        <td className="py-2 pr-4 text-slate-400 text-xs whitespace-nowrap">{fmtDate(c.lastUsedAt)}</td>
                        <td className="py-2 pr-4 text-slate-400 text-center">{c.usageCount}</td>
                        <td className="py-2">
                          {c.status === 'active' ? (
                            <button
                              onClick={() => revokeCode(c.id)}
                              disabled={actionLoading === c.id}
                              title="Revoke access"
                              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => restoreCode(c.id)}
                              disabled={actionLoading === c.id}
                              title="Restore access"
                              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
