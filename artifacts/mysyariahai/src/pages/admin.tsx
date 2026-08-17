import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdminPage() {
  const { t, mode } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("practitioner");
  const [customCode, setCustomCode] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [createdCode, setCreatedCode] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [filter, setFilter] = useState("all");

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: api.admin.getStats,
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ["admin-codes"],
    queryFn: api.admin.listCodes,
  });

  const createMutation = useMutation({
    mutationFn: api.admin.createCode,
    onSuccess: (data) => {
      setCreatedCode(data);
      setNewName("");
      setNewRole("practitioner");
      setCustomCode("");
      setUseCustom(false);
      queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: api.admin.toggleCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.admin.deleteCode(id);
    },
    onSuccess: () => {
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin-codes"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Card className="border-destructive/30">
          <CardContent className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-destructive/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 15v.01M12 9v2m0 0a9 9 0 110 0m0-9a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
            <h2 className="text-lg font-serif font-bold text-foreground mb-2">
              {t("Access Denied", "Akses Ditolak")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("This page is restricted to administrators only.", "Halaman ini terhad kepada pentadbir sahaja.")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredCodes = codes?.filter((c: any) => {
    if (filter === "all") return true;
    if (filter === "active") return c.isActive;
    if (filter === "inactive") return !c.isActive;
    return c.role === filter;
  }) || [];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const roleLabel = (role: string) => {
    const labels: Record<string, { en: string; bm: string }> = {
      practitioner: { en: "Practitioner", bm: "Pengamal" },
      admin: { en: "Administrator", bm: "Pentadbir" },
      judge: { en: "Judge", bm: "Hakim" },
    };
    const l = labels[role] || { en: role, bm: role };
    return mode === "bm" ? l.bm : l.en;
  };

  const roleBadgeClass = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-900/30 text-red-400 border-red-800";
      case "judge": return "bg-violet-900/30 text-violet-400 border-violet-800";
      default: return "bg-emerald-900/30 text-emerald-400 border-emerald-800";
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">
            {t("Admin Dashboard", "Papan Pemuka Pentadbir")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("Manage access codes and user accounts", "Urus kod akses dan akaun pengguna")}
          </p>
        </div>
        <Button
          onClick={() => { setShowCreate(true); setCreatedCode(null); }}
          className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
        >
          <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14m-7-7h14" />
          </svg>
          {t("Generate Code", "Jana Kod")}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-secondary/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-secondary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t("Total Codes", "Jumlah Kod")}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-emerald-900/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
              <p className="text-xs text-muted-foreground">{t("Active", "Aktif")}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-blue-900/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.used}</p>
              <p className="text-xs text-muted-foreground">{t("Used", "Digunakan")}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-red-900/30">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.inactive}</p>
              <p className="text-xs text-muted-foreground">{t("Inactive", "Tidak Aktif")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {stats?.byRole && (
        <div className="flex flex-wrap gap-2">
          {stats.byRole.map((r: any) => (
            <Badge key={r.role} className={roleBadgeClass(r.role)}>
              {roleLabel(r.role)}: {r.count}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {["all", "active", "inactive", "practitioner", "admin", "judge"].map((f) => (
          <Badge
            key={f}
            variant={filter === f ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? t("All", "Semua") :
             f === "active" ? t("Active", "Aktif") :
             f === "inactive" ? t("Inactive", "Tidak Aktif") :
             roleLabel(f)}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid gap-3">
          {filteredCodes.map((c: any) => (
            <Card key={c.id} className={`border-border/50 ${!c.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-medium text-sm text-foreground truncate">{c.name}</h3>
                      <Badge className={`text-xs ${roleBadgeClass(c.role)}`}>
                        {roleLabel(c.role)}
                      </Badge>
                      <Badge className={`text-xs ${c.isActive ? "bg-emerald-900/30 text-emerald-400 border-emerald-800" : "bg-red-900/30 text-red-400 border-red-800"}`}>
                        {c.isActive ? t("Active", "Aktif") : t("Inactive", "Tidak Aktif")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="text-sm font-mono text-secondary bg-secondary/10 px-2 py-0.5 rounded">{c.code}</code>
                      <button
                        onClick={() => handleCopy(c.code)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title={mode === "bm" ? "Salin kod" : "Copy code"}
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>
                        {t("Created", "Dicipta")}: {new Date(c.createdAt).toLocaleDateString('en-GB')}
                      </span>
                      {c.lastUsedAt && (
                        <span>
                          {t("Last used", "Terakhir digunakan")}: {new Date(c.lastUsedAt).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => toggleMutation.mutate(c.id)}
                      disabled={toggleMutation.isPending}
                    >
                      {c.isActive ? t("Deactivate", "Nyahaktif") : t("Activate", "Aktifkan")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setConfirmDelete(c.id)}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6" />
                        <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredCodes.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t("No access codes found", "Tiada kod akses ditemui")}
            </p>
          )}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {createdCode
                ? t("Access Code Generated", "Kod Akses Telah Dijana")
                : t("Generate New Access Code", "Jana Kod Akses Baharu")}
            </DialogTitle>
            <DialogDescription>
              {createdCode
                ? t("Your new access code is ready.", "Kod akses baharu anda telah sedia.")
                : t("Create a new access code for a user.", "Cipta kod akses baharu untuk pengguna.")}
            </DialogDescription>
          </DialogHeader>

          {createdCode ? (
            <div className="space-y-4">
              <Card className="border-secondary/30 bg-secondary/5">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">{t("Access Code", "Kod Akses")}</p>
                  <code className="text-2xl font-mono font-bold text-secondary tracking-wider">{createdCode.code}</code>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t("Name", "Nama")}</p>
                  <p className="text-foreground">{createdCode.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("Role", "Peranan")}</p>
                  <Badge className={roleBadgeClass(createdCode.role)}>{roleLabel(createdCode.role)}</Badge>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => handleCopy(createdCode.code)}
                >
                  {copied ? t("Copied!", "Disalin!") : t("Copy Code", "Salin Kod")}
                </Button>
                <Button onClick={() => { setShowCreate(false); setCreatedCode(null); }}>
                  {t("Done", "Selesai")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  {t("User Name", "Nama Pengguna")}
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={mode === "bm" ? "cth: Peguam Ahmad" : "e.g. Lawyer Ahmad"}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  {t("Role", "Peranan")}
                </label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="practitioner">{t("Practitioner", "Pengamal")}</SelectItem>
                    <SelectItem value="admin">{t("Administrator", "Pentadbir")}</SelectItem>
                    <SelectItem value="judge">{t("Judge", "Hakim")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="useCustom"
                  checked={useCustom}
                  onChange={(e) => setUseCustom(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="useCustom" className="text-sm text-muted-foreground cursor-pointer">
                  {t("Set custom code", "Tetapkan kod tersuai")}
                </label>
              </div>

              {useCustom && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">
                    {t("Custom Code (min 6 characters)", "Kod Tersuai (min 6 aksara)")}
                  </label>
                  <Input
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="e.g. PEGUAM001"
                    className="font-mono"
                  />
                </div>
              )}

              {createMutation.error && (
                <p className="text-sm text-destructive">
                  {(createMutation.error as Error).message}
                </p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  {t("Cancel", "Batal")}
                </Button>
                <Button
                  onClick={() => createMutation.mutate({
                    name: newName,
                    role: newRole,
                    ...(useCustom && customCode ? { customCode } : {}),
                  })}
                  disabled={!newName.trim() || createMutation.isPending || (useCustom && customCode.length < 6)}
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  {createMutation.isPending
                    ? t("Generating...", "Menjana...")
                    : t("Generate", "Jana")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {t("Delete Access Code?", "Padam Kod Akses?")}
            </DialogTitle>
            <DialogDescription>
              {t("This will permanently remove the access code.", "Ini akan memadamkan kod akses secara kekal.")}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "This action cannot be undone. The user will no longer be able to log in with this code.",
              "Tindakan ini tidak boleh dibuat asal. Pengguna tidak lagi boleh log masuk dengan kod ini."
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("Cancel", "Batal")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
              disabled={deleteMutation.isPending}
            >
              {t("Delete", "Padam")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
