import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Shield, KeyRound, Plus, Copy, Check, Trash2, RefreshCw, LogOut, Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { adminApi } from "@/lib/admin-api";

type Resource = {
  key: string;
  label: string;
  fields: { name: string; label: string; type: "text" | "textarea" | "number" }[];
};

const RESOURCES: Resource[] = [
  {
    key: "topics",
    label: "Topics",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "orderIndex", label: "Order Index", type: "number" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "content", label: "Content (HTML allowed)", type: "textarea" },
    ],
  },
  {
    key: "case-laws",
    label: "Case Laws",
    fields: [
      { name: "caseName", label: "Case Name", type: "text" },
      { name: "citation", label: "Citation", type: "text" },
      { name: "court", label: "Court", type: "text" },
      { name: "year", label: "Year", type: "number" },
      { name: "category", label: "Category", type: "text" },
      { name: "summary", label: "Summary", type: "textarea" },
      { name: "keyPrinciples", label: "Key Principles", type: "textarea" },
      { name: "fullText", label: "Full Text", type: "textarea" },
    ],
  },
  {
    key: "cause-papers",
    label: "Cause Papers",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "court", label: "Court", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "language", label: "Language (ms or en; defaults to ms)", type: "text" },
      { name: "sourceId", label: "Paired Malay ID (English only)", type: "number" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "templateContent", label: "Template Content", type: "textarea" },
    ],
  },
  {
    key: "workflows",
    label: "Workflows",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "estimatedDuration", label: "Estimated Duration", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "steps", label: "Steps (JSON array)", type: "textarea" },
    ],
  },
  {
    key: "sample-documents",
    label: "Sample Documents",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "documentType", label: "Document Type", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "language", label: "Language (ms or en; defaults to ms)", type: "text" },
      { name: "sourceId", label: "Paired Malay ID (English only)", type: "number" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "content", label: "Content", type: "textarea" },
    ],
  },
  {
    key: "glossary",
    label: "Glossary",
    fields: [
      { name: "term", label: "Term", type: "text" },
      { name: "malayTranslation", label: "Malay Translation", type: "text" },
      { name: "relatedTerms", label: "Related Terms", type: "text" },
      { name: "definition", label: "Definition", type: "textarea" },
    ],
  },
  {
    key: "costs-fees",
    label: "Costs & Fees",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "amount", label: "Amount", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "courtType", label: "Court Type", type: "text" },
      { name: "legalBasis", label: "Legal Basis", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },
];

export function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("access-codes");

  useEffect(() => {
    adminApi.session().then((r) => {
      if (!r?.isAdmin) setLocation("/admin/login");
    }).catch(() => setLocation("/admin/login"));
  }, [setLocation]);

  const handleLogout = async () => {
    try { await adminApi.logout(); } catch {}
    setLocation("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md border border-primary/20">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-lg font-bold">MyCrimAi Admin</h1>
              <p className="text-xs text-muted-foreground">Practice Companion Administration</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-card/50 p-1">
            <TabsTrigger value="access-codes" className="gap-2">
              <KeyRound className="h-4 w-4" /> Access Codes
            </TabsTrigger>
            {RESOURCES.map((r) => (
              <TabsTrigger key={r.key} value={r.key}>{r.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="access-codes" className="mt-4">
            <AccessCodesPanel />
          </TabsContent>

          {RESOURCES.map((r) => (
            <TabsContent key={r.key} value={r.key} className="mt-4">
              <ResourcePanel resource={r} />
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

// ===== Access Codes Panel =====

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AccessCodesPanel() {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.listAccessCodes();
      setCodes(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load codes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const generate = async () => {
    setError("");
    try {
      await adminApi.createAccessCode(label, expiresAt || null);
      setLabel("");
      refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to generate code.");
    }
  };

  const bulkGenerate = async () => {
    setError("");
    setBulkBusy(true);
    try {
      await adminApi.bulkCreateAccessCodes(bulkCount, bulkPrefix, expiresAt || null);
      setBulkPrefix("");
      refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to bulk-generate codes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const setExpiry = async (id: number) => {
    const current = codes.find((c) => c.id === id);
    const seed = current?.expiresAt ? toLocalInput(new Date(current.expiresAt)) : "";
    const input = prompt(
      "Set expiry date/time (YYYY-MM-DDTHH:MM, local time). Leave empty to clear (no expiry).",
      seed,
    );
    if (input === null) return;
    await adminApi.updateAccessCode(id, {
      expiresAt: input.trim() === "" ? null : new Date(input).toISOString(),
    });
    refresh();
  };

  const copy = async (code: string, id: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const toggleActive = async (id: number, isActive: boolean) => {
    await adminApi.updateAccessCode(id, { isActive: !isActive });
    refresh();
  };

  const release = async (id: number) => {
    await adminApi.releaseAccessCode(id);
    refresh();
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this access code permanently? Anyone using it will be locked out.")) return;
    await adminApi.deleteAccessCode(id);
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Generate New Access Code
          </CardTitle>
          <CardDescription>
            Each generated code can be used by only one user at a time. Set an optional expiry date to auto-disable codes after a deadline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">Expiry (applies to both single + bulk below)</label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">Leave empty for no expiry. Time is in your local timezone.</p>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-2">
            <p className="text-sm font-semibold">Single Code</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Optional label (e.g. a name or note to remember who this code is for)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="flex-1"
              />
              <Button onClick={generate}>
                <Plus className="h-4 w-4 mr-2" /> Generate Code
              </Button>
            </div>
          </div>

          <div className="border-t border-border/40 pt-4 space-y-2">
            <p className="text-sm font-semibold">Bulk Generate (create many codes at once)</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="number"
                min={1}
                max={200}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
                className="w-full sm:w-28"
                placeholder="Count"
              />
              <Input
                placeholder="Optional label prefix — codes will be numbered automatically"
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                className="flex-1"
              />
              <Button onClick={bulkGenerate} disabled={bulkBusy} variant="secondary">
                <Plus className="h-4 w-4 mr-2" />
                {bulkBusy ? `Generating ${bulkCount}…` : `Generate ${bulkCount}`}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Max 200 codes per batch.</p>
          </div>

          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Access Codes</CardTitle>
            <CardDescription>{codes.length} code{codes.length === 1 ? "" : "s"} total</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No access codes yet. Generate one above.</p>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => (
                <div key={c.id} className="border border-border/50 rounded-md p-3 bg-card/30">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-base font-semibold text-primary break-all">{c.code}</code>
                        <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copy(c.code, c.id)}>
                          {copied === c.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        {c.inUse && <Badge variant="default" className="bg-amber-700">In Use</Badge>}
                        {!c.isActive && <Badge variant="outline">Disabled</Badge>}
                        {c.expiresAt && new Date(c.expiresAt).getTime() < Date.now() && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                        {c.expiresAt && new Date(c.expiresAt).getTime() >= Date.now() && (
                          <Badge variant="outline" className="border-amber-700/60 text-amber-300">
                            Expires {new Date(c.expiresAt).toLocaleDateString('en-GB')}
                          </Badge>
                        )}
                      </div>
                      {c.label && <p className="text-sm text-muted-foreground mt-1">{c.label}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Created: {new Date(c.createdAt).toLocaleString('en-GB')}
                        {c.lastSeenAt && ` · Last active: ${new Date(c.lastSeenAt).toLocaleString('en-GB')}`}
                        {c.expiresAt && ` · Expires: ${new Date(c.expiresAt).toLocaleString('en-GB')}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {c.inUse && (
                        <Button size="sm" variant="outline" onClick={() => release(c.id)}>
                          Release
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setExpiry(c.id)}>
                        Expiry
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(c.id, c.isActive)}>
                        {c.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(c.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Generic Resource Panel =====

function ResourcePanel({ resource }: { resource: Resource }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.list(resource.key);
      setItems(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [resource.key]);

  const blank = () => {
    const obj: any = {};
    resource.fields.forEach((f) => {
      obj[f.name] = f.name === "language" ? "ms" : f.type === "number" ? 0 : "";
    });
    return obj;
  };

  const save = async (data: any) => {
    setError("");
    try {
      if (data.id) {
        await adminApi.update(resource.key, data.id, data);
      } else {
        await adminApi.create(resource.key, data);
      }
      setEditing(null);
      setCreating(false);
      refresh();
    } catch (err: any) {
      setError(err?.message || "Save failed.");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this item permanently?")) return;
    await adminApi.remove(resource.key, id);
    refresh();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{resource.label}</CardTitle>
          <CardDescription>{items.length} item{items.length === 1 ? "" : "s"}</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setCreating(true); setEditing(blank()); }}>
            <Plus className="h-4 w-4 mr-2" /> New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}

        {editing && (
          <ItemForm
            resource={resource}
            initial={editing}
            onCancel={() => { setEditing(null); setCreating(false); }}
            onSave={save}
            isNew={creating}
          />
        )}

        {items.length === 0 && !editing ? (
          <p className="text-sm text-muted-foreground text-center py-8">No items yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="border border-border/50 rounded-md p-3 bg-card/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {item.title || item.caseName || item.term || `#${item.id}`}
                    </p>
                    {(item.description || item.summary || item.definition) && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {item.description || item.summary || item.definition}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      ID #{item.id}
                      {item.category && ` · ${item.category}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing({ ...item }); setCreating(false); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemForm({
  resource, initial, onCancel, onSave, isNew,
}: {
  resource: Resource;
  initial: any;
  onCancel: () => void;
  onSave: (data: any) => void;
  isNew: boolean;
}) {
  const [data, setData] = useState<any>(initial);

  const setField = (name: string, value: any) => setData({ ...data, [name]: value });

  return (
    <div className="border border-primary/30 rounded-md p-4 mb-4 bg-card/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{isNew ? "Create new" : `Editing #${data.id}`}</h3>
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-3">
        {resource.fields.map((f) => (
          <div key={f.name}>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea
                rows={f.name === "content" || f.name === "fullText" || f.name === "templateContent" ? 10 : 4}
                value={data[f.name] ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
                className="font-mono text-sm"
              />
            ) : f.type === "number" ? (
              <Input
                type="number"
                value={data[f.name] ?? 0}
                onChange={(e) => setField(f.name, Number(e.target.value))}
              />
            ) : (
              <Input
                value={data[f.name] ?? ""}
                onChange={(e) => setField(f.name, e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(data)}>
          <Save className="h-4 w-4 mr-2" /> Save
        </Button>
      </div>
    </div>
  );
}
