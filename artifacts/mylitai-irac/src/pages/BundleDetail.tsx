import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  CircleAlert,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Save,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccessGate } from "@/components/AccessGate";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getBundle,
  getBundleTypes,
  addBundleDocument,
  deleteBundleDocument,
  updateBundleDocument,
  reorderBundle,
  updateBundle,
  type BundleDocInput,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]";

function BundleDetailBody() {
  const { t } = useLanguage();
  const params = useParams();
  const id = Number(params.id);
  const qc = useQueryClient();

  const bundle = useQuery({
    queryKey: ["bundle", id],
    queryFn: () => getBundle(id),
    enabled: !Number.isNaN(id),
  });
  const types = useQuery({ queryKey: ["bundle-types"], queryFn: getBundleTypes });

  const [doc, setDoc] = useState<BundleDocInput>({
    title: "",
    section: "",
    docType: "exhibit",
    docDate: "",
    pageCount: 1,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [startPage, setStartPage] = useState<number | "">("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["bundle", id] });

  const showSubErr = (ex: unknown) => {
    const m = (ex as Error).message;
    setErr(m === "SUBSCRIPTION_REQUIRED" ? t("bun.subRequired") : m);
  };

  const addDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doc.title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await addBundleDocument(id, { ...doc });
      setDoc({ title: "", section: "", docType: "exhibit", docDate: "", pageCount: 1 });
      await invalidate();
    } catch (ex) {
      showSubErr(ex);
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (docId: number) => {
    try {
      await deleteBundleDocument(id, docId);
      await invalidate();
    } catch (ex) {
      showSubErr(ex);
    }
  };

  const changePageCount = async (docId: number, pageCount: number) => {
    if (Number.isNaN(pageCount) || pageCount < 1) return;
    try {
      await updateBundleDocument(id, docId, { pageCount });
      await invalidate();
    } catch (ex) {
      showSubErr(ex);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const items = bundle.data?.documents ?? [];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const order = items.map((d) => d.id);
    [order[index], order[target]] = [order[target], order[index]];
    try {
      await reorderBundle(id, order);
      await invalidate();
    } catch (ex) {
      showSubErr(ex);
    }
  };

  const saveStartPage = async () => {
    if (startPage === "" || Number.isNaN(Number(startPage))) return;
    try {
      await updateBundle(id, { startPage: Number(startPage) });
      await invalidate();
    } catch (ex) {
      showSubErr(ex);
    }
  };

  const copyIndex = () => {
    const items = bundle.data?.index.items ?? [];
    const text = items
      .map((it) => `${it.tab}\t${it.title}${it.docDate ? ` (${it.docDate})` : ""}\t${it.pageLabel}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (bundle.isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-24 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
      </div>
    );
  }
  if (bundle.isError || !bundle.data) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 w-full">
        <div className="flex items-center gap-2 text-destructive justify-center">
          <CircleAlert className="h-5 w-5" /> {t("common.errorRetry")}
        </div>
        <div className="text-center mt-4">
          <Link href="/bundles" className="text-sm text-[hsl(var(--gold-bright))]">
            ← {t("bun.back")}
          </Link>
        </div>
      </div>
    );
  }

  const b = bundle.data;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 w-full">
      <Link
        href="/bundles"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> {t("bun.back")}
      </Link>

      <div className="mb-6">
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-gradient-gold">{b.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {b.suitNo ? `${b.suitNo} · ` : ""}
          {b.parties || ""}
          {b.court ? ` · ${b.court}` : ""}
        </p>
        <div className="rule-gold mt-3" />
      </div>

      <div className="grid lg:grid-cols-[360px_1fr] gap-6">
        {/* Add document */}
        <Card className="self-start">
          <CardContent className="p-6 space-y-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">{t("bun.addDoc")}</h2>
            <form onSubmit={addDoc} className="space-y-3">
              <div>
                <Label>{t("bun.doc.title")}</Label>
                <Input
                  className="mt-1"
                  value={doc.title}
                  onChange={(e) => setDoc({ ...doc, title: e.target.value })}
                />
              </div>
              <div>
                <Label>{t("bun.doc.section")}</Label>
                <Input
                  className="mt-1"
                  placeholder={t("bun.doc.sectionHint")}
                  value={doc.section}
                  onChange={(e) => setDoc({ ...doc, section: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("bun.doc.type")}</Label>
                  <select
                    className={`${selectCls} mt-1`}
                    value={doc.docType}
                    onChange={(e) => setDoc({ ...doc, docType: e.target.value })}
                  >
                    {(types.data?.docTypes ?? []).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("bun.doc.pages")}</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={doc.pageCount}
                    onChange={(e) => setDoc({ ...doc, pageCount: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>{t("bun.doc.date")}</Label>
                <Input
                  className="mt-1"
                  placeholder={t("bun.doc.dateHint")}
                  value={doc.docDate}
                  onChange={(e) => setDoc({ ...doc, docDate: e.target.value })}
                />
              </div>
              {err && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <CircleAlert className="h-4 w-4" />
                  {err}
                </div>
              )}
              <Button type="submit" disabled={busy || !doc.title.trim()} className="w-full gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t("bun.doc.add")}
              </Button>
            </form>

            <div className="pt-2 border-t border-border">
              <Label>{t("bun.startPage")}</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  min={1}
                  placeholder={String(b.startPage ?? 1)}
                  value={startPage}
                  onChange={(e) => setStartPage(e.target.value === "" ? "" : Number(e.target.value))}
                />
                <Button variant="outline" onClick={saveStartPage} className="gap-1.5 shrink-0">
                  <Save className="h-4 w-4" /> {t("common.save")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Index */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              {t("bun.index")}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({b.index.totalPages} {t("bun.pages")})
              </span>
            </h2>
            {b.documents.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyIndex}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? t("common.copied") : t("bun.copyIndex")}
              </Button>
            )}
          </div>

          {b.documents.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                {t("bun.noDocs")}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[40px_1fr_90px_90px] gap-2 px-3 py-2 bg-background/60 border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{t("bun.col.tab")}</span>
                <span>{t("bun.col.document")}</span>
                <span className="text-center">{t("bun.col.pages")}</span>
                <span className="text-right">{t("bun.col.actions")}</span>
              </div>
              {b.index.items.map((it, i) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[40px_1fr_90px_90px] gap-2 px-3 py-2.5 border-b border-border last:border-0 items-center"
                >
                  <span className="font-mono text-sm text-[hsl(var(--gold-bright))]">{it.tab}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{it.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {it.section ? `${it.section} · ` : ""}
                      {it.docType}
                      {it.docDate ? ` · ${it.docDate}` : ""} · {t("bun.p")} {it.pageLabel}
                    </p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    defaultValue={it.pageCount}
                    className="h-8 text-center text-sm"
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (n !== it.pageCount) changePageCount(it.id, n);
                    }}
                  />
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === b.index.items.length - 1}
                      className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeDoc(it.id)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BundleDetail() {
  return (
    <AccessGate>
      <BundleDetailBody />
    </AccessGate>
  );
}
