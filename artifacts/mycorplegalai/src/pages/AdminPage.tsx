import { useState, useEffect, useCallback } from "react";
import { Scale, Shield, Plus, Trash2, Copy, Check, Power, UserX, Eye, EyeOff, RefreshCw } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface ActiveSession {
  deviceInfo: string;
  loggedInAt: string;
  lastSeenAt: string;
}

type AccessTier = "legacy_full" | "student" | "practitioner" | "firm";

interface AccessCodeRecord {
  id: number;
  code: string;
  label: string | null;
  isActive: boolean;
  tier: AccessTier;
  createdAt: string;
  activeSession: ActiveSession | null;
}

const TIER_OPTIONS: { value: AccessTier; label: string }[] = [
  { value: "legacy_full", label: "Full Access (Legacy)" },
  { value: "student", label: "Student" },
  { value: "practitioner", label: "Practitioner" },
  { value: "firm", label: "Firm" },
];

const TIER_BADGE: Record<AccessTier, string> = {
  legacy_full: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  student: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  practitioner: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  firm: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const TIER_LABEL: Record<AccessTier, string> = {
  legacy_full: "Full Access",
  student: "Student",
  practitioner: "Practitioner",
  firm: "Firm",
};

// Grandfather cutoff: codes created on/before this instant get permanent full access
const GRANDFATHER_CUTOFF = new Date("2026-06-07T23:59:59+08:00").getTime();

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/corp/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("admin_token", data.adminToken);
        onLogin();
      } else {
        setError("Invalid admin credentials.");
      }
    } catch {
      setError("Connection failed.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-purple-500/20 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-purple-400" />
            </div>
            <h1 className="font-serif text-xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage access codes & sessions</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin Password"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/50"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Access Admin Panel"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function adminFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("admin_token");
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers as Record<string, string>,
      Authorization: `Bearer ${token}`,
    },
  });
}

function AdminDashboard() {
  const [codes, setCodes] = useState<AccessCodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [newTier, setNewTier] = useState<AccessTier>("legacy_full");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showCodes, setShowCodes] = useState<Set<number>>(new Set());

  const fetchCodes = useCallback(async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/corp/admin/codes`);
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        window.location.reload();
        return;
      }
      const data = await res.json();
      setCodes(data.codes || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCodes();
    const interval = setInterval(fetchCodes, 10000);
    return () => clearInterval(interval);
  }, [fetchCodes]);

  const createCode = async () => {
    setCreating(true);
    try {
      await adminFetch(`${API_BASE}/api/corp/admin/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel || undefined, tier: newTier }),
      });
      setNewLabel("");
      setNewTier("legacy_full");
      await fetchCodes();
    } catch {}
    setCreating(false);
  };

  const toggleCode = async (id: number) => {
    try {
      await adminFetch(`${API_BASE}/api/corp/admin/codes/${id}/toggle`, { method: "PATCH" });
      await fetchCodes();
    } catch {}
  };

  const deleteCode = async (id: number) => {
    if (!confirm("Delete this access code permanently?")) return;
    try {
      await adminFetch(`${API_BASE}/api/corp/admin/codes/${id}`, { method: "DELETE" });
      await fetchCodes();
    } catch {}
  };

  const kickSession = async (id: number) => {
    try {
      await adminFetch(`${API_BASE}/api/corp/admin/codes/${id}/kick`, { method: "POST" });
      await fetchCodes();
    } catch {}
  };

  const copyCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const toggleShowCode = (id: number) => {
    setShowCodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeCodes = codes.filter((c) => c.isActive);
  const onlineCount = codes.filter((c) => c.activeSession).length;

  const handleLogout = async () => {
    try {
      await adminFetch(`${API_BASE}/api/corp/admin/logout`, { method: "POST" });
    } catch {}
    localStorage.removeItem("admin_token");
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Scale className="w-6 h-6 text-primary" />
            <h1 className="font-serif text-lg font-bold text-primary">MYCorpLegalAI</h1>
            <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <button onClick={handleLogout} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-purple-500/15 rounded-xl p-5">
            <p className="text-sm text-muted-foreground">Total Codes</p>
            <p className="text-3xl font-bold text-foreground mt-1">{codes.length}</p>
          </div>
          <div className="bg-card border border-purple-500/15 rounded-xl p-5">
            <p className="text-sm text-muted-foreground">Active Codes</p>
            <p className="text-3xl font-bold text-green-400 mt-1">{activeCodes.length}</p>
          </div>
          <div className="bg-card border border-purple-500/15 rounded-xl p-5">
            <p className="text-sm text-muted-foreground">Currently Online</p>
            <p className="text-3xl font-bold text-purple-400 mt-1">{onlineCount}</p>
          </div>
        </div>

        <div className="bg-card border border-purple-500/15 rounded-xl p-5">
          <h2 className="font-serif font-semibold text-foreground mb-4">Generate New Access Code</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label (e.g. user name or description)"
              className="flex-1 px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/50 text-sm"
            />
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as AccessTier)}
              className="px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-purple-500/50 text-sm"
            >
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={createCode}
              disabled={creating}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {creating ? "Creating..." : "Generate Code"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Codes created on or before 7 Jun 2026 are permanently grandfathered to Full Access
            regardless of the tier selected.
          </p>
        </div>

        <div className="bg-card border border-purple-500/15 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-serif font-semibold text-foreground">Access Codes</h2>
            <button onClick={fetchCodes} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : codes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No access codes yet. Generate one above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {codes.map((code) => (
                <div key={code.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-mono text-sm text-foreground tracking-wider">
                          {showCodes.has(code.id) ? code.code : "••••-••••-••••"}
                        </span>
                        <button onClick={() => toggleShowCode(code.id)} className="text-muted-foreground hover:text-foreground">
                          {showCodes.has(code.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => copyCode(code.id, code.code)} className="text-muted-foreground hover:text-foreground">
                          {copiedId === code.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${code.isActive ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                          {code.isActive ? "Active" : "Revoked"}
                        </span>
                        {(() => {
                          const grandfathered = new Date(code.createdAt).getTime() <= GRANDFATHER_CUTOFF;
                          const effective: AccessTier = grandfathered ? "legacy_full" : code.tier;
                          return (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TIER_BADGE[effective]}`}
                              title={grandfathered ? "Grandfathered to Full Access (created before cutoff)" : `Tier: ${TIER_LABEL[effective]}`}
                            >
                              {TIER_LABEL[effective]}
                              {grandfathered && " ·legacy"}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {code.label && <span>{code.label}</span>}
                        <span>Created {new Date(code.createdAt).toLocaleDateString()}</span>
                        {code.activeSession && (
                          <span className="flex items-center gap-1 text-purple-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                            Online — {code.activeSession.deviceInfo?.substring(0, 50)}...
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {code.activeSession && (
                        <button
                          onClick={() => kickSession(code.id)}
                          title="Kick session"
                          className="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-colors"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleCode(code.id)}
                        title={code.isActive ? "Revoke" : "Reactivate"}
                        className={`p-2 rounded-lg transition-colors ${code.isActive ? "text-yellow-400 hover:bg-yellow-500/10" : "text-green-400 hover:bg-green-500/10"}`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteCode(code.id)}
                        title="Delete permanently"
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("admin_token"));

  if (!authed) {
    return <AdminLogin onLogin={() => setAuthed(true)} />;
  }

  return <AdminDashboard />;
}
