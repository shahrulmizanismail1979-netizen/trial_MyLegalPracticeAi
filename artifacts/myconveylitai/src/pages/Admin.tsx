import { useState, useEffect, useCallback } from 'react';
import {
  Shield, BarChart3, Clock, Zap, ArrowLeft, LogIn,
  Bot, PenTool, ShieldAlert, ListChecks, FileSearch,
  GitCompare, MapPin, Receipt, Activity, Database,
  BookOpen, Scale, FileText, Briefcase, Hash, Layers,
  Mail, ClipboardCheck, FileQuestion, Calculator,
  Stamp, TrendingDown, Home, Gavel, AlertOctagon, Search,
  HardHat, UserX, Globe, FileCheck, Landmark, Building2,
  Users, Plus, Trash2, RefreshCw, ToggleLeft, ToggleRight,
  Loader2, Copy, KeyRound,
  Brain, PlayCircle, Library, CheckSquare, Timer, GraduationCap, Microscope,
} from 'lucide-react';
import { useLocation } from 'wouter';

const TOOL_META: Record<string, { label: string; icon: typeof Bot; color: string }> = {
  tutor:           { label: 'AI Tutor',           icon: Bot,           color: 'text-blue-400' },
  drafter:         { label: 'AI Drafter',          icon: PenTool,       color: 'text-emerald-400' },
  reviewer:        { label: 'SPA Reviewer',        icon: FileSearch,    color: 'text-violet-400' },
  comparator:      { label: 'Clause Comparator',   icon: GitCompare,    color: 'text-cyan-400' },
  title:           { label: 'Title Interpreter',   icon: MapPin,        color: 'text-amber-400' },
  risk:            { label: 'Risk Scanner',        icon: ShieldAlert,   color: 'text-red-400' },
  checklist:       { label: 'Checklist Generator', icon: ListChecks,    color: 'text-green-400' },
  deadlines:       { label: 'Deadline Calculator', icon: Clock,         color: 'text-orange-400' },
  quotation:       { label: 'Fee Quotation',       icon: Receipt,       color: 'text-pink-400' },
  advice:          { label: 'Advice Letter',       icon: Mail,          color: 'text-indigo-400' },
  duediligence:    { label: 'Due Diligence',       icon: ClipboardCheck,color: 'text-teal-400' },
  opinion:         { label: 'Legal Opinion',       icon: Scale,         color: 'text-purple-400' },
  requisition:     { label: 'Requisition Letter',  icon: FileQuestion,  color: 'text-sky-400' },
  completion:      { label: 'Completion Statement',icon: Calculator,    color: 'text-lime-400' },
  caseresearch:    { label: 'Case Law Research',   icon: BookOpen,      color: 'text-fuchsia-400' },
  stampduty:       { label: 'Stamp Duty',          icon: Stamp,         color: 'text-yellow-400' },
  rpgt:            { label: 'RPGT Advisor',        icon: TrendingDown,  color: 'text-rose-400' },
  tenancy:         { label: 'Tenancy Drafter',     icon: Home,          color: 'text-emerald-300' },
  poa:             { label: 'Power of Attorney',   icon: Gavel,         color: 'text-blue-300' },
  caveat:          { label: 'Caveat Advisor',      icon: AlertOctagon,  color: 'text-orange-300' },
  landsearch:      { label: 'Land Search',         icon: Search,        color: 'text-violet-300' },
  devclaim:        { label: 'Developer Claim',     icon: HardHat,       color: 'text-amber-300' },
  bankruptcy:      { label: 'Bankruptcy Search',   icon: UserX,         color: 'text-red-300' },
  foreignpurchase: { label: 'Foreign Purchase',    icon: Globe,         color: 'text-cyan-300' },
  loandoc:         { label: 'Loan Doc Review',     icon: FileCheck,     color: 'text-green-300' },
  taxcompliance:   { label: 'Tax Compliance',      icon: Landmark,      color: 'text-pink-300' },
  strata:          { label: 'Strata Management',   icon: Building2,     color: 'text-indigo-300' },
  quiz:            { label: 'Quiz Generator',      icon: Brain,         color: 'text-blue-200' },
  simulate:        { label: 'Tx Simulator',        icon: PlayCircle,    color: 'text-emerald-200' },
  'clause-library':{ label: 'Clause Library',      icon: Library,       color: 'text-violet-200' },
  'analyze-doc':   { label: 'Doc Analyzer',        icon: FileText,      color: 'text-cyan-200' },
  compliance:      { label: 'Compliance Check',    icon: CheckSquare,   color: 'text-amber-200' },
  timeline:        { label: 'Timeline Gen',        icon: Timer,         color: 'text-orange-200' },
  'mock-exam':     { label: 'Mock Exam',           icon: GraduationCap, color: 'text-pink-200' },
  'analyze-case':  { label: 'Case Analyzer',       icon: Microscope,    color: 'text-teal-200' },
};

interface ToolStat {
  tool: string;
  count: number;
  avgDuration: string | null;
  totalInputChars: string | null;
  totalOutputChars: string | null;
}

interface DailyUsage {
  date: string;
  count: number;
}

interface RecentLog {
  id: number;
  tool: string;
  inputLength: number;
  outputLength: number;
  durationMs: number;
  createdAt: string;
}

interface StatsData {
  totalQueries: number;
  todayQueries: number;
  totalUsers: number;
  toolBreakdown: ToolStat[];
  dailyUsage: DailyUsage[];
  recentLogs: RecentLog[];
}

interface UserRecord {
  id: number;
  accessCode: string | null;
  email: string | null;
  username?: string | null;
  displayName: string;
  role: string;
  isActive: boolean;
  subscriptionTier?: string;
  subscriptionStatus?: string | null;
  grandfathered?: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}


export function Admin() {
  const [, setLocation] = useLocation();
  const [adminToken, setAdminToken] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'users'>('analytics');

  const [usersList, setUsersList] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [createLoading, setCreateLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [regeneratedCode, setRegeneratedCode] = useState<{ id: number; code: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const fetchStats = useCallback(async (token: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/convey-admin/stats`, { headers: { 'x-admin-token': token } });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error('Failed to fetch stats:', e); }
    finally { setLoading(false); }
  }, []);

  const fetchUsers = useCallback(async (token: string) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`/api/convey-admin/users`, { headers: { 'x-admin-token': token } });
      if (res.ok) { const data = await res.json(); setUsersList(data.users); }
    } catch (e) { console.error('Failed to fetch users:', e); }
    finally { setUsersLoading(false); }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`/api/convey-admin/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) { setAdminToken(password); setIsAuthed(true); setPassword(''); fetchStats(password); fetchUsers(password); }
      else setLoginError('Invalid admin password');
    } catch { setLoginError('Connection error'); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const res = await fetch(`/api/convey-admin/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
        body: JSON.stringify({ email: newEmail, displayName: newDisplayName, role: newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedCode(data.user?.accessCode ?? null);
        setNewEmail(''); setNewDisplayName(''); setNewRole('user');
        fetchUsers(adminToken);
      }
      else { const err = await res.json(); alert(err.error || 'Failed to create user'); }
    } catch { alert('Connection error'); }
    finally { setCreateLoading(false); }
  };

  const toggleUser = async (id: number) => {
    try {
      await fetch(`/api/convey-admin/users/${id}/toggle`, { method: 'PATCH', headers: { 'x-admin-token': adminToken } });
      fetchUsers(adminToken);
    } catch { alert('Failed to toggle user'); }
  };

  const regenerateCode = async (id: number) => {
    if (!confirm('Regenerate this account\'s access code? The old code will stop working immediately.')) return;
    try {
      const res = await fetch(`/api/convey-admin/users/${id}/reset-password`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      });
      if (res.ok) {
        const data = await res.json();
        setRegeneratedCode({ id, code: data.accessCode });
        fetchUsers(adminToken);
      } else { const err = await res.json(); alert(err.error || 'Failed to regenerate access code'); }
    } catch { alert('Failed to regenerate access code'); }
  };

  const deleteUser = async (id: number, label: string) => {
    if (!confirm(`Delete user "${label}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/convey-admin/users/${id}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } });
      if (res.ok) fetchUsers(adminToken);
      else { const err = await res.json(); alert(err.error || 'Failed to delete user'); }
    } catch { alert('Connection error'); }
  };

  useEffect(() => {
    if (isAuthed && adminToken) {
      const interval = setInterval(() => { fetchStats(adminToken); fetchUsers(adminToken); }, 30000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isAuthed, adminToken, fetchStats, fetchUsers]);

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-gold-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-2xl mb-4">
              <Shield className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-slate-100">Admin Dashboard</h1>
            <p className="text-sm text-slate-400 mt-1">MyConveyLitAI Administration</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Admin Password"
                className="w-full bg-gold-900 border border-gold-700 rounded-xl pl-12 pr-4 py-3.5 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                data-testid="input-admin-password" />
            </div>
            {loginError && <p className="text-red-400 text-sm text-center">{loginError}</p>}
            <button type="submit" className="w-full py-3.5 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors" data-testid="button-admin-login">
              Access Dashboard
            </button>
          </form>
          <button onClick={() => setLocation('/')} className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors" data-testid="link-back-home">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  const totalCharsOut = stats?.toolBreakdown.reduce((s, t) => s + Number(t.totalOutputChars || 0), 0) ?? 0;
  const avgResponseTime = stats?.toolBreakdown.length
    ? Math.round(stats.toolBreakdown.reduce((s, t) => s + Number(t.avgDuration || 0), 0) / stats.toolBreakdown.length) : 0;
  const maxDailyCount = Math.max(...(stats?.dailyUsage.map(d => d.count) ?? [1]), 1);

  const CONTENT_STATS = [
    { label: 'Theory Topics', count: 21, icon: BookOpen, color: 'text-blue-400' },
    { label: 'Workflows', count: 62, icon: Layers, color: 'text-emerald-400' },
    { label: 'Form Templates', count: 16, icon: FileText, color: 'text-violet-400' },
    { label: 'Landmark Cases', count: 100, icon: Scale, color: 'text-amber-400' },
    { label: 'Legal Terms', count: 193, icon: Hash, color: 'text-cyan-400' },
    { label: 'AI Tools', count: 35, icon: Briefcase, color: 'text-pink-400' },
  ];

  return (
    <div className="min-h-screen bg-gold-950 text-slate-100">
      <header className="sticky top-0 z-50 bg-gold-950/80 backdrop-blur-md border-b border-gold-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-amber-500/10 rounded-lg shrink-0"><Shield className="w-5 h-5 text-amber-500" /></div>
              <div className="min-w-0">
                <h1 className="font-serif font-bold text-base sm:text-lg text-slate-100 truncate">Admin Dashboard</h1>
                <p className="text-xs text-slate-500 hidden sm:block">MyConveyLitAI Analytics & User Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { fetchStats(adminToken); fetchUsers(adminToken); }} disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-gold-900 border border-gold-700 rounded-lg text-xs sm:text-sm text-slate-300 hover:bg-gold-800 transition-colors disabled:opacity-50" data-testid="button-refresh-stats">
                <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Refresh</span>
              </button>
              <button onClick={() => setLocation('/dashboard')}
                className="flex items-center gap-1.5 px-2.5 py-2 bg-gold-900 border border-gold-700 rounded-lg text-xs sm:text-sm text-slate-300 hover:bg-gold-800 transition-colors" data-testid="link-to-dashboard">
                <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>
          </div>
          <div className="flex bg-gold-900 border border-gold-800 rounded-lg p-1 w-full">
            <button onClick={() => setActiveTab('analytics')} data-testid="tab-analytics"
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'analytics' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'}`}>
              <BarChart3 className="w-4 h-4" /> Analytics
            </button>
            <button onClick={() => setActiveTab('users')} data-testid="tab-users"
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${activeTab === 'users' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'}`}>
              <Users className="w-4 h-4" /> Users ({stats?.totalUsers ?? 0})
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {activeTab === 'analytics' && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={BarChart3} label="Total AI Queries" value={stats?.totalQueries ?? 0} color="text-amber-400" />
              <StatCard icon={Zap} label="Today's Queries" value={stats?.todayQueries ?? 0} color="text-emerald-400" />
              <StatCard icon={Clock} label="Avg Response (ms)" value={avgResponseTime} color="text-blue-400" />
              <StatCard icon={Users} label="Total Users" value={stats?.totalUsers ?? 0} color="text-violet-400" />
            </div>

            <div>
              <h2 className="font-serif font-semibold text-lg text-slate-200 mb-4">Content Library</h2>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                {CONTENT_STATS.map(({ label, count, icon: Icon, color }) => (
                  <div key={label} className="bg-gold-900 border border-gold-800 rounded-xl p-4 text-center">
                    <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                    <div className="text-xl font-bold text-slate-100">{count}</div>
                    <div className="text-xs text-slate-400 mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-gold-900 border border-gold-800 rounded-xl p-6">
                <h2 className="font-serif font-semibold text-lg text-slate-200 mb-4">Tool Usage</h2>
                {stats?.toolBreakdown && stats.toolBreakdown.length > 0 ? (
                  <div className="space-y-3">
                    {stats.toolBreakdown.map(t => {
                      const meta = TOOL_META[t.tool] ?? { label: t.tool, icon: Bot, color: 'text-slate-400' };
                      const Icon = meta.icon;
                      const pct = stats.totalQueries > 0 ? (t.count / stats.totalQueries) * 100 : 0;
                      return (
                        <div key={t.tool} className="flex items-center gap-3" data-testid={`stat-tool-${t.tool}`}>
                          <Icon className={`w-4 h-4 ${meta.color} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-slate-200 truncate">{meta.label}</span>
                              <span className="text-sm text-slate-400 ml-2 shrink-0">{t.count}</span>
                            </div>
                            <div className="h-2 bg-gold-800 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No usage data yet. Stats appear after AI tools are used.</p>
                  </div>
                )}
              </div>

              <div className="bg-gold-900 border border-gold-800 rounded-xl p-6">
                <h2 className="font-serif font-semibold text-lg text-slate-200 mb-4">Last 7 Days</h2>
                {stats?.dailyUsage && stats.dailyUsage.length > 0 ? (
                  <div className="flex items-end gap-2 h-48">
                    {stats.dailyUsage.map(d => {
                      const heightPct = (d.count / maxDailyCount) * 100;
                      const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short' });
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                          <span className="text-xs text-amber-400 font-medium">{d.count}</span>
                          <div className="w-full bg-amber-500/30 rounded-t-lg transition-all min-h-[4px]" style={{ height: `${Math.max(heightPct, 3)}%` }} />
                          <span className="text-[10px] text-slate-500">{dayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8"><Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-500">No daily data yet.</p></div>
                )}
              </div>
            </div>

            <div className="bg-gold-900 border border-gold-800 rounded-xl p-6">
              <h2 className="font-serif font-semibold text-lg text-slate-200 mb-4">Recent Activity</h2>
              {stats?.recentLogs && stats.recentLogs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-recent-logs">
                    <thead>
                      <tr className="border-b border-gold-800 text-slate-400">
                        <th className="text-left py-2 px-3 font-medium">Tool</th>
                        <th className="text-right py-2 px-3 font-medium">Input</th>
                        <th className="text-right py-2 px-3 font-medium">Output</th>
                        <th className="text-right py-2 px-3 font-medium">Duration</th>
                        <th className="text-right py-2 px-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentLogs.map(log => {
                        const meta = TOOL_META[log.tool] ?? { label: log.tool, icon: Bot, color: 'text-slate-400' };
                        const Icon = meta.icon;
                        return (
                          <tr key={log.id} className="border-b border-gold-800/50 hover:bg-gold-800/30 transition-colors">
                            <td className="py-2.5 px-3"><div className="flex items-center gap-2"><Icon className={`w-3.5 h-3.5 ${meta.color} shrink-0`} /><span className="text-slate-200">{meta.label}</span></div></td>
                            <td className="text-right py-2.5 px-3 text-slate-400">{formatNumber(log.inputLength)}</td>
                            <td className="text-right py-2.5 px-3 text-slate-400">{formatNumber(log.outputLength)}</td>
                            <td className="text-right py-2.5 px-3">
                              <span className={`${log.durationMs > 10000 ? 'text-red-400' : log.durationMs > 5000 ? 'text-amber-400' : 'text-emerald-400'}`}>{(log.durationMs / 1000).toFixed(1)}s</span>
                            </td>
                            <td className="text-right py-2.5 px-3 text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8"><Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-500">No activity logged yet.</p></div>
              )}
            </div>
          </>
        )}

        {activeTab === 'users' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif font-semibold text-xl text-slate-200">User Management</h2>
              <button onClick={() => setShowCreateUser(!showCreateUser)} data-testid="button-create-user"
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors">
                <Plus className="w-4 h-4" /> Create User
              </button>
            </div>

            {showCreateUser && (
              <div className="bg-gold-900 border border-gold-800 rounded-xl p-6 mb-6">
                {createdCode ? (
                  <div className="text-center py-4">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 mb-4 border border-amber-500/20">
                      <KeyRound className="w-7 h-7 text-amber-500" />
                    </div>
                    <h3 className="font-serif font-semibold text-lg text-slate-200 mb-2">Account created</h3>
                    <p className="text-sm text-slate-400 mb-4">Share this access code with the user — it is their only way to sign in.</p>
                    <div className="flex items-center justify-center gap-2 mb-5">
                      <code className="text-xl font-mono font-bold tracking-widest text-amber-400 bg-gold-950/60 border border-amber-500/30 rounded-xl px-5 py-3 select-all" data-testid="text-created-access-code">
                        {createdCode}
                      </code>
                      <button type="button" onClick={() => copyToClipboard(createdCode, 'created')} title="Copy access code" data-testid="button-copy-created-code"
                        className="p-3 text-slate-400 hover:text-amber-400 hover:bg-gold-800 rounded-xl transition-colors">
                        {copiedField === 'created' ? <CheckSquare className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button type="button" onClick={() => setCreatedCode(null)}
                        className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors">
                        <Plus className="w-4 h-4" /> Create another
                      </button>
                      <button type="button" onClick={() => { setCreatedCode(null); setShowCreateUser(false); }}
                        className="px-6 py-3 bg-gold-800 text-slate-300 rounded-xl hover:bg-gold-700 transition-colors">Done</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="font-serif font-semibold text-lg text-slate-200 mb-4">Create New User</h3>
                    <form onSubmit={handleCreateUser} className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                        <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="e.g. ahmad@example.com"
                          className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" data-testid="input-new-email" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
                        <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="e.g. Ahmad bin Abdullah" required
                          className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500" data-testid="input-new-display-name" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Role</label>
                        <select value={newRole} onChange={e => setNewRole(e.target.value)}
                          className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-amber-500 appearance-none" data-testid="select-new-role">
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="space-y-2 flex items-end">
                        <p className="text-xs text-slate-500 leading-relaxed">A unique access code is generated automatically and shown after the account is created.</p>
                      </div>
                      <div className="sm:col-span-2 flex gap-3">
                        <button type="submit" disabled={createLoading} data-testid="button-submit-create-user"
                          className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50">
                          {createLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
                        </button>
                        <button type="button" onClick={() => setShowCreateUser(false)}
                          className="px-6 py-3 bg-gold-800 text-slate-300 rounded-xl hover:bg-gold-700 transition-colors">Cancel</button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}

            {usersLoading ? (
              <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500 mx-auto" /></div>
            ) : (
              <div className="bg-gold-900 border border-gold-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm" data-testid="table-users">
                  <thead>
                    <tr className="border-b border-gold-800 text-slate-400 bg-gold-950/50">
                      <th className="text-left py-3 px-4 font-medium">User</th>
                      <th className="text-left py-3 px-4 font-medium">Role</th>
                      <th className="text-center py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Last Login</th>
                      <th className="text-right py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.map(user => (
                      <tr key={user.id} className="border-b border-gold-800/50 hover:bg-gold-800/30 transition-colors" data-testid={`row-user-${user.id}`}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{user.displayName}</div>
                          {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
                          {user.accessCode && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <code className="text-xs font-mono tracking-wider text-amber-400/90" data-testid={`text-access-code-${user.id}`}>{user.accessCode}</code>
                              <button onClick={() => copyToClipboard(user.accessCode!, `code-${user.id}`)} title="Copy access code" data-testid={`button-copy-code-${user.id}`}
                                className="p-1 text-slate-500 hover:text-amber-400 transition-colors">
                                {copiedField === `code-${user.id}` ? <CheckSquare className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-bold uppercase px-2 py-1 rounded-md ${user.role === 'admin' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs font-semibold ${user.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs hidden md:table-cell">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => toggleUser(user.id)} title={user.isActive ? 'Deactivate' : 'Activate'} data-testid={`button-toggle-user-${user.id}`}
                              className="p-2 text-slate-400 hover:text-amber-400 hover:bg-gold-800 rounded-lg transition-colors">
                              {user.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button onClick={() => regenerateCode(user.id)} title="Regenerate Access Code" data-testid={`button-regenerate-code-${user.id}`}
                              className="p-2 text-slate-400 hover:text-blue-400 hover:bg-gold-800 rounded-lg transition-colors">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteUser(user.id, user.displayName)} title="Delete User" data-testid={`button-delete-user-${user.id}`}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-gold-800 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {regeneratedCode?.id === user.id && (
                            <div className="mt-2 flex items-center justify-end gap-2 text-xs text-amber-300">
                              <span>New code:</span>
                              <code className="font-mono tracking-wider" data-testid={`text-regenerated-code-${user.id}`}>{regeneratedCode.code}</code>
                              <button onClick={() => copyToClipboard(regeneratedCode.code, `regen-${user.id}`)} title="Copy new code" data-testid={`button-copy-regen-${user.id}`}
                                className="p-1 text-slate-500 hover:text-amber-400 transition-colors">
                                {copiedField === `regen-${user.id}` ? <CheckSquare className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {usersList.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No users found.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Bot; label: string; value: number | string; color: string }) {
  return (
    <div className="bg-gold-900 border border-gold-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-gold-800 rounded-lg"><Icon className={`w-5 h-5 ${color}`} /></div>
      </div>
      <div className="text-2xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
