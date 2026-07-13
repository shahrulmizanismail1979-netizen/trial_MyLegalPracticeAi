import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAccidentAdminLogin,
  useAccidentAdminCheck,
  useAccidentListAccessCodes,
  useAccidentCreateAccessCode,
  useAccidentDeleteAccessCode,
  useAccidentUpdateAccessCode,
  useAccidentGetAdminDashboard,
  getAccidentListAccessCodesQueryKey,
  getAccidentGetAdminDashboardQueryKey,
  getAccidentAdminCheckQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Lock, Plus, Trash2, Copy, Check, Eye, EyeOff,
  Users, Key, BarChart3, ArrowLeft, ToggleLeft, ToggleRight, Shield
} from "lucide-react";

export default function Admin() {
  const { data: adminStatus, isLoading } = useAccidentAdminCheck({ query: { queryKey: getAccidentAdminCheckQueryKey() } });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!adminStatus?.isAdmin) {
    return <AdminLoginForm />;
  }

  return <AdminDashboard />;
}

function AdminLoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const adminLogin = useAccidentAdminLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    adminLogin.mutate(
      { data: { password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAccidentAdminCheckQueryKey() });
        },
        onError: (err: any) => {
          setError(err?.data?.error || "Invalid admin password");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-serif font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">MyAccidentAi Administration</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Admin Password</label>
              <Input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                data-testid="input-admin-password"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="text-admin-error">{error}</p>}
            <Button type="submit" className="w-full h-12 bg-primary" disabled={adminLogin.isPending} data-testid="button-admin-login">
              {adminLogin.isPending ? "Logging in..." : "Login as Admin"}
            </Button>
          </form>
        </div>
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-primary hover:underline" data-testid="link-admin-home">
            <ArrowLeft className="h-3 w-3" /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const queryClient = useQueryClient();
  const { data: codes } = useAccidentListAccessCodes({ query: { queryKey: getAccidentListAccessCodesQueryKey() } });
  const { data: dashboard } = useAccidentGetAdminDashboard({ query: { queryKey: getAccidentGetAdminDashboardQueryKey() } });
  const createCode = useAccidentCreateAccessCode();
  const deleteCode = useAccidentDeleteAccessCode();
  const updateCode = useAccidentUpdateAccessCode();

  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newMaxUsers, setNewMaxUsers] = useState("5");
  const [newCode, setNewCode] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCreate = () => {
    if (!newLabel.trim()) return;
    createCode.mutate(
      {
        data: {
          label: newLabel.trim(),
          maxUsers: parseInt(newMaxUsers) || 5,
          code: newCode.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAccidentListAccessCodesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAccidentGetAdminDashboardQueryKey() });
          setShowCreate(false);
          setNewLabel("");
          setNewMaxUsers("5");
          setNewCode("");
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteCode.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAccidentListAccessCodesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getAccidentGetAdminDashboardQueryKey() });
        },
      }
    );
  };

  const handleToggle = (id: number, currentlyActive: boolean) => {
    updateCode.mutate(
      { id, data: { isActive: !currentlyActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getAccidentListAccessCodesQueryKey() });
        },
      }
    );
  };

  const copyToClipboard = (code: string, id: number) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50">
        <div className="container flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <Link href="/" data-testid="link-dashboard-home">
              <span className="text-xl font-serif font-bold">MyAccident<span className="text-primary">Ai</span></span>
            </Link>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Admin</span>
          </div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-site">
            Back to Site
          </Link>
        </div>
      </header>

      <div className="container px-6 py-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-6" data-testid="stat-total-codes">
            <div className="flex items-center gap-3 mb-2">
              <Key className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Access Codes</span>
            </div>
            <div className="text-3xl font-bold">{dashboard?.totalCodes || 0}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6" data-testid="stat-active-codes">
            <div className="flex items-center gap-3 mb-2">
              <Check className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Active Codes</span>
            </div>
            <div className="text-3xl font-bold">{dashboard?.activeCodes || 0}</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6" data-testid="stat-total-usage">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Usage</span>
            </div>
            <div className="text-3xl font-bold">{dashboard?.totalUsage || 0}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-lg font-serif font-bold">Access Codes</h2>
            <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 bg-primary" data-testid="button-toggle-create">
              <Plus className="h-4 w-4" /> Generate New Code
            </Button>
          </div>

          {showCreate && (
            <div className="p-6 border-b border-border bg-muted/30">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Label / Description</label>
                  <Input
                    placeholder="e.g. Batch 2026 Students"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    data-testid="input-new-label"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Max Users</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="5"
                    value={newMaxUsers}
                    onChange={(e) => setNewMaxUsers(e.target.value)}
                    data-testid="input-new-max-users"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Custom Code (optional)</label>
                  <Input
                    placeholder="Auto-generated if empty"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className="uppercase"
                    data-testid="input-new-code"
                  />
                </div>
                <Button onClick={handleCreate} disabled={createCode.isPending || !newLabel.trim()} className="bg-primary" data-testid="button-create-code">
                  {createCode.isPending ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-border">
            {(!codes || codes.length === 0) && (
              <div className="p-12 text-center text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No access codes yet. Create one to get started.</p>
              </div>
            )}
            {codes?.map((c) => (
              <div key={c.id} className="flex items-center gap-4 p-5 hover:bg-muted/30 transition-colors" data-testid={`row-code-${c.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-medium">{c.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${c.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs">{c.code}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.currentUsers} / {c.maxUsers} users
                    </span>
                    <span className="text-xs">Created: {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(c.code, c.id)}
                    data-testid={`button-copy-${c.id}`}
                  >
                    {copiedId === c.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggle(c.id, c.isActive)}
                    data-testid={`button-toggle-${c.id}`}
                  >
                    {c.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(c.id)}
                    data-testid={`button-delete-${c.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {dashboard?.recentUsage && dashboard.recentUsage.length > 0 && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden mt-8">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-serif font-bold">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border">
              {dashboard.recentUsage.map((usage, i) => (
                <div key={i} className="flex items-center gap-4 p-4 text-sm" data-testid={`row-usage-${i}`}>
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{usage.codeLabel}</span>
                  <span className="text-muted-foreground flex-1">{usage.sessionId.slice(0, 8)}...</span>
                  <span className="text-xs text-muted-foreground">{new Date(usage.usedAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
