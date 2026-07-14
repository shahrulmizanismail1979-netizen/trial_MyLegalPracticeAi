import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderOpen,
  Loader2,
  CircleAlert,
  Plus,
  Trash2,
  ChevronRight,
  Library as LibraryIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccessGate } from "@/components/AccessGate";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  listBundles,
  createBundle,
  deleteBundle,
  getBundleTypes,
  listMatters,
  type BundleInput,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]";

function BundlesBody() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const bundles = useQuery({ queryKey: ["bundles"], queryFn: listBundles });
  const types = useQuery({ queryKey: ["bundle-types"], queryFn: getBundleTypes });
  const matters = useQuery({ queryKey: ["matters"], queryFn: listMatters });

  const [show, setShow] = useState(false);
  const [form, setForm] = useState<BundleInput>({
    title: "",
    bundleType: "",
    court: "",
    suitNo: "",
    parties: "",
    startPage: 1,
    matterId: null,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await createBundle({
        ...form,
        matterId: form.matterId ? Number(form.matterId) : null,
      });
      setForm({
        title: "",
        bundleType: "",
        court: "",
        suitNo: "",
        parties: "",
        startPage: 1,
        matterId: null,
      });
      setShow(false);
      await qc.invalidateQueries({ queryKey: ["bundles"] });
    } catch (ex) {
      const m = (ex as Error).message;
      setErr(m === "SUBSCRIPTION_REQUIRED" ? t("bun.subRequired") : m);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await deleteBundle(id);
      await qc.invalidateQueries({ queryKey: ["bundles"] });
    } catch (ex) {
      setErr((ex as Error).message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 w-full">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">
            {t("bun.title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">{t("bun.desc")}</p>
          <div className="rule-gold mt-4" />
        </div>
        <Button onClick={() => setShow((s) => !s)} className="gap-2">
          <Plus className="h-4 w-4" /> {t("bun.new")}
        </Button>
      </div>

      {show && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <form onSubmit={create} className="space-y-3">
              <div>
                <Label>{t("bun.field.title")}</Label>
                <Input
                  className="mt-1"
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>{t("bun.field.type")}</Label>
                  <select
                    className={`${selectCls} mt-1`}
                    value={form.bundleType}
                    onChange={(e) => setForm({ ...form, bundleType: e.target.value })}
                  >
                    <option value="">{t("bun.field.selectType")}</option>
                    {(types.data?.bundleTypes ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("bun.field.matter")}</Label>
                  <select
                    className={`${selectCls} mt-1`}
                    value={form.matterId ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, matterId: e.target.value ? Number(e.target.value) : null })
                    }
                  >
                    <option value="">{t("bun.field.noMatter")}</option>
                    {(matters.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                        {m.suitNo ? ` — ${m.suitNo}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label>{t("bun.field.court")}</Label>
                  <Input
                    className="mt-1"
                    value={form.court}
                    onChange={(e) => setForm({ ...form, court: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("bun.field.suitNo")}</Label>
                  <Input
                    className="mt-1"
                    value={form.suitNo}
                    onChange={(e) => setForm({ ...form, suitNo: e.target.value })}
                  />
                </div>
                <div>
                  <Label>{t("bun.field.startPage")}</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={form.startPage}
                    onChange={(e) => setForm({ ...form, startPage: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>{t("bun.field.parties")}</Label>
                <Input
                  className="mt-1"
                  value={form.parties}
                  onChange={(e) => setForm({ ...form, parties: e.target.value })}
                />
              </div>
              {err && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {err}
                </div>
              )}
              <Button type="submit" disabled={busy || !form.title.trim()} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("bun.create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {bundles.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {bundles.isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> {t("common.errorRetry")}
        </div>
      )}
      {bundles.data && bundles.data.length === 0 && !show && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <LibraryIcon className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--gold)/0.5)]" />
            {t("bun.empty")}
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {(bundles.data ?? []).map((b) => (
          <Card key={b.id}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <Link
                href={`/bundles/${b.id}`}
                className="flex items-center gap-3 min-w-0 group flex-1"
              >
                <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground group-hover:text-[hsl(var(--gold-bright))] truncate">
                    {b.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {b.suitNo ? `${b.suitNo} · ` : ""}
                    {b.parties || t("bun.noParties")}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(b.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Link href={`/bundles/${b.id}`}>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Bundles() {
  return (
    <AccessGate>
      <BundlesBody />
    </AccessGate>
  );
}
