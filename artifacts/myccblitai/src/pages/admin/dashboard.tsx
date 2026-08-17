import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Power, Trash2, LogOut } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { getAdminToken, clearAdminToken } from "./login";

interface CodeRow {
  id: number;
  code: string;
  label: string | null;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);

  const authedFetch = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = getAdminToken();
    if (!token) {
      setLocation("/admin");
      throw new Error("Not authenticated");
    }
    const res = await fetch(apiUrl(path), {
      ...init,
      headers: {
        ...(init.headers || {}),
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status === 401 || res.status === 403) {
      clearAdminToken();
      setLocation("/admin");
      throw new Error("Session expired");
    }
    return res;
  }, [setLocation]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/admin/codes");
      const data = await res.json();
      setCodes(data.codes || []);
    } catch {
      // handled in authedFetch
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    if (!getAdminToken()) {
      setLocation("/admin");
      return;
    }
    load();
  }, [load, setLocation]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await authedFetch("/api/admin/codes", {
        method: "POST",
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (data.code) {
        toast({ title: "New code generated", description: data.code.code });
        setLabel("");
        load();
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleToggle = async (row: CodeRow) => {
    await authedFetch(`/api/admin/codes/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !row.active }),
    });
    load();
  };

  const handleDelete = async (row: CodeRow) => {
    if (!confirm(`Delete code ${row.code}?`)) return;
    await authedFetch(`/api/admin/codes/${row.id}`, { method: "DELETE" });
    load();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: code });
  };

  const handleLogout = () => {
    clearAdminToken();
    setLocation("/admin");
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Generate and manage practitioner access codes</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Generate New Access Code</CardTitle>
            <CardDescription>Optionally add a label (e.g. lawyer's name or firm)</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
            <Button onClick={handleGenerate} disabled={generating}>
              <Plus className="w-4 h-4 mr-2" />
              {generating ? "Generating..." : "Generate"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access Codes ({codes.length})</CardTitle>
            <CardDescription>Click a code to copy it</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : codes.length === 0 ? (
              <p className="text-muted-foreground">No codes yet. Generate your first one above.</p>
            ) : (
              <div className="space-y-2">
                {codes.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => handleCopy(row.code)}
                        className="font-mono text-lg font-semibold tracking-wider hover:text-primary inline-flex items-center gap-2"
                        title="Click to copy"
                      >
                        {row.code} <Copy className="w-3 h-3 opacity-60" />
                      </button>
                      {row.label && (
                        <span className="text-sm text-muted-foreground truncate">{row.label}</span>
                      )}
                      <Badge variant={row.active ? "default" : "secondary"}>
                        {row.active ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground hidden md:block">
                      {row.lastUsedAt
                        ? `Last used: ${new Date(row.lastUsedAt).toLocaleDateString('en-GB')}`
                        : "Never used"}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleToggle(row)} title={row.active ? "Disable" : "Enable"}>
                        <Power className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(row)} title="Delete">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
