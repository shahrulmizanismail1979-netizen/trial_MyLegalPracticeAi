import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileSignature,
  Loader2,
  CircleAlert,
  ScrollText,
  Paperclip,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StreamOutput } from "@/components/StreamOutput";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getAffidavitTypes,
  runAffidavitDraft,
  type AffidavitDraftInput,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]";

export default function Affidavits() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["affidavit-types"],
    queryFn: getAffidavitTypes,
  });

  const [typeId, setTypeId] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [out, setOut] = useState("");
  const [disc, setDisc] = useState<string | undefined>();
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = useMemo(
    () => data?.types.find((tp) => tp.id === typeId),
    [data, typeId],
  );

  const grouped = useMemo(() => {
    const affidavits = data?.types.filter((tp) => tp.category === "affidavit") ?? [];
    const supporting = data?.types.filter((tp) => tp.category === "supporting") ?? [];
    return { affidavits, supporting };
  }, [data]);

  const run = () => {
    if (!typeId) return;
    setGen(true);
    setOut("");
    setDisc(undefined);
    setErr(null);
    const input: AffidavitDraftInput = {
      typeId,
      court: values.court ?? "",
      parties: values.parties ?? "",
      deponent: values.deponent ?? "",
      context: values.context ?? "",
      facts: values.facts ?? "",
      exhibits: values.exhibits ?? "",
      additionalDetails: values.additionalDetails ?? "",
    };
    runAffidavitDraft(input, {
      onContent: (c) => setOut((p) => p + c),
      onDone: (d) => {
        setDisc(d);
        setGen(false);
      },
      onError: (m) => {
        setErr(m);
        setGen(false);
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">
          {t("aff.title")}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">{t("aff.desc")}</p>
        <div className="rule-gold mt-4" />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> {t("common.errorRetry")}
        </div>
      )}

      {data && (
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* Document picker */}
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("aff.group.affidavits")}
              </p>
              <div className="space-y-1.5">
                {grouped.affidavits.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setTypeId(tp.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                      typeId === tp.id
                        ? "border-[hsl(var(--gold-bright))] bg-[hsl(var(--gold)/0.08)] text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--gold)/0.4)]"
                    }`}
                  >
                    {tp.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {t("aff.group.supporting")}
              </p>
              <div className="space-y-1.5">
                {grouped.supporting.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => setTypeId(tp.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                      typeId === tp.id
                        ? "border-[hsl(var(--gold-bright))] bg-[hsl(var(--gold)/0.08)] text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--gold)/0.4)]"
                    }`}
                  >
                    {tp.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form / details */}
          <div>
            {!selected && (
              <Card>
                <CardContent className="p-10 text-center text-muted-foreground">
                  <ScrollText className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--gold)/0.5)]" />
                  {t("aff.pickPrompt")}
                </CardContent>
              </Card>
            )}

            {selected && (
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileSignature className="h-5 w-5 text-primary shrink-0" />
                      <h2 className="font-serif text-xl font-semibold text-foreground">
                        {selected.name}
                      </h2>
                      {selected.hasExhibits && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[hsl(var(--gold)/0.4)] text-[hsl(var(--gold-bright))]">
                          <Paperclip className="h-3 w-3" /> {t("aff.exhibitsBadge")}
                        </span>
                      )}
                    </div>
                    <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground">
                      {selected.basis}
                    </span>
                    <p className="text-sm text-foreground/85 leading-relaxed mt-2">
                      {selected.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-semibold text-foreground/70">{t("aff.whenToUse")}: </span>
                      {selected.whenToUse}
                    </p>
                  </div>

                  {selected.caveats.length > 0 && (
                    <div className="rounded-md border border-[hsl(var(--gold)/0.3)] bg-[hsl(var(--gold)/0.05)] p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--gold-bright))] mb-1.5">
                        <TriangleAlert className="h-3.5 w-3.5" /> {t("aff.caveats")}
                      </p>
                      <ul className="space-y-1">
                        {selected.caveats.map((c, i) => (
                          <li key={i} className="text-xs text-foreground/75 leading-snug">
                            • {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    {(data.fields ?? []).map((f) => (
                      <div key={f.key}>
                        <Label>{f.label}</Label>
                        {f.long ? (
                          <Textarea
                            className="mt-1"
                            rows={f.key === "facts" ? 4 : 2}
                            placeholder={f.placeholder}
                            value={values[f.key] ?? ""}
                            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                          />
                        ) : (
                          <Input
                            className="mt-1"
                            placeholder={f.placeholder}
                            value={values[f.key] ?? ""}
                            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <Button onClick={run} disabled={gen} className="w-full gap-2">
                    {gen ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> {t("aff.drafting")}
                      </>
                    ) : (
                      <>
                        <FileSignature className="h-4 w-4" /> {t("aff.button")}
                      </>
                    )}
                  </Button>

                  {err && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <CircleAlert className="h-4 w-4" />
                      {err}
                    </div>
                  )}

                  {out && (
                    <StreamOutput
                      output={out}
                      disclaimer={disc}
                      generating={gen}
                      saveKind="affidavit"
                      saveTitle={selected.name}
                      saveLabel={t("aff.title")}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
