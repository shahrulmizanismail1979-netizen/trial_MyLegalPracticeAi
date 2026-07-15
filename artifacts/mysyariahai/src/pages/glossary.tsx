import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function GlossaryPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data: terms, isLoading } = useQuery({
    queryKey: ["glossary", gate, search, letter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (letter) params.letter = letter;
      return api.glossary.list(params);
    },
  });

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Glossary", "Kembali ke Glosari")}
        </Button>
        <GlossaryDetail term={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Shariah Legal Glossary", "Glosari Undang-Undang Syariah")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Arabic, Malay, and English legal terminology", "Istilah undang-undang dalam Bahasa Arab, Melayu, dan Inggeris")}
        </p>
      </div>

      <Input
        placeholder={mode === "bm" ? "Cari istilah..." : "Search terms..."}
        value={search}
        onChange={(e) => { setSearch(e.target.value); setLetter(""); }}
        className="max-w-md"
      />

      <div className="flex flex-wrap gap-1">
        <Badge
          variant={letter === "" ? "default" : "outline"}
          className="cursor-pointer text-xs"
          onClick={() => setLetter("")}
        >
          {t("All", "Semua")}
        </Badge>
        {letters.map((l) => (
          <Badge
            key={l}
            variant={letter === l ? "default" : "outline"}
            className="cursor-pointer text-xs w-7 justify-center"
            onClick={() => { setLetter(l); setSearch(""); }}
          >
            {l}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {terms?.map((term: any) => (
            <Card key={term.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(term)}>
              <CardContent className="p-4">
                {term.termArabic && (
                  <p className="text-lg font-serif text-secondary text-right mb-1" dir="rtl">{term.termArabic}</p>
                )}
                <h3 className="font-serif font-semibold text-foreground text-sm">{term.termEn}</h3>
                <p className="text-xs text-muted-foreground">{term.termBm}</p>
                <Badge variant="outline" className="mt-2 text-xs">{mode === "bm" ? term.categoryBm : term.category}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function GlossaryDetail({ term: t2 }: { term: any }) {
  const { t, mode } = useLanguage();

  return (
    <div className="space-y-4">
      <div>
        {t2.termArabic && (
          <p className="text-3xl font-serif text-secondary text-right mb-2" dir="rtl">{t2.termArabic}</p>
        )}
        <h2 className="text-xl font-serif font-bold text-foreground">{t2.termEn}</h2>
        <p className="text-sm text-muted-foreground">{t2.termBm}</p>
        <Badge variant="outline" className="mt-2">{mode === "bm" ? t2.categoryBm : t2.category}</Badge>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold text-sm">{t("Definition", "Definisi")}</h3>
        </CardHeader>
        <CardContent>
          {mode === "bm" ? (
            <p className="text-sm text-foreground/90">{t2.definitionBm}</p>
          ) : mode === "en" ? (
            <p className="text-sm text-foreground/90">{t2.definitionEn}</p>
          ) : (
            <>
              <p className="text-sm text-foreground/90">{t2.definitionEn}</p>
              <hr className="my-3 border-border/50" />
              <p className="text-sm text-muted-foreground italic">{t2.definitionBm}</p>
            </>
          )}
        </CardContent>
      </Card>

      {t2.source && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Source", "Sumber")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">{t2.source}</p>
          </CardContent>
        </Card>
      )}

      {t2.practicalExample && (
        <Card className="border-border/50 bg-muted/20">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Practical Example", "Contoh Praktikal")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-foreground/90">{t2.practicalExample}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
