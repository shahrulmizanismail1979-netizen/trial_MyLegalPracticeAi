import { aiStreamFetch } from "@/lib/ai-stream-fetch";
import { useState, useRef } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";

const API_BASE = "/api/sya";

const TYPE_COLORS: Record<string, string> = {
  provision: "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  case: "bg-blue-900/30 text-blue-400 border-blue-800",
  verse: "bg-violet-900/30 text-violet-400 border-violet-800",
  fatwa: "bg-amber-900/30 text-amber-400 border-amber-800",
  glossary: "bg-pink-900/30 text-pink-400 border-pink-800",
  legislation: "bg-cyan-900/30 text-cyan-400 border-cyan-800",
};

const TYPE_LABELS: Record<string, { en: string; bm: string }> = {
  provision: { en: "Provision", bm: "Peruntukan" },
  case: { en: "Case Law", bm: "Kes" },
  verse: { en: "Quranic Verse", bm: "Ayat Al-Quran" },
  fatwa: { en: "Fatwa", bm: "Fatwa" },
  glossary: { en: "Glossary", bm: "Glosari" },
  legislation: { en: "Legislation", bm: "Perundangan" },
};

const ROUTE_MAP: Record<string, string> = {
  provision: "/provisions",
  case: "/cases",
  verse: "/quranic-verses",
  fatwa: "/fatwas",
  glossary: "/glossary",
  legislation: "/legislation",
};

export default function SmartSearchPage() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;
  const [, setLocation] = useLocation();

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setResults(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await aiStreamFetch(`${API_BASE}/smart-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, language: mode }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      let fullText = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.error) { setError(data.error); break; }
            if (data.content) fullText += data.content;
            if (data.done) break;
          }
        }
      }

      const cleaned = fullText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setResults(JSON.parse(cleaned));
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const navigateToResult = (type: string, id: number) => {
    const route = ROUTE_MAP[type];
    if (route) {
      const storageKey = type === "case" ? "navigateToCaseId" :
                         type === "provision" ? "navigateToProvisionsId" :
                         type === "verse" ? "navigateToQuranic-versesId" :
                         type === "fatwa" ? "navigateToFatwasId" : null;
      if (storageKey) sessionStorage.setItem(storageKey, String(id));
      setLocation(route);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Smart Search", "Carian Pintar")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("AI-powered search across all modules - provisions, cases, fatwas, verses, glossary & legislation", "Carian berkuasa AI merentasi semua modul - peruntukan, kes, fatwa, ayat, glosari & perundangan")}
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t("e.g. What are the requirements for fasakh application?", "cth: Apakah syarat-syarat permohonan fasakh?")}
              className="flex-1"
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searching || !query.trim()} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6">
              {searching ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m-7-7H3m18 0h-2m-1.5-7.5L16 7m-8 10l-1.5 1.5M19.5 7.5L18 9M6 15l-1.5 1.5" /></svg>
                  {t("Searching...", "Mencari...")}
                </span>
              ) : t("Search", "Cari")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {searching && (
        <div className="text-center py-12">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center animate-pulse">
            <svg className="w-6 h-6 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </div>
          <p className="text-sm text-muted-foreground">{t("AI is searching across all modules...", "AI sedang mencari merentasi semua modul...")}</p>
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <Card className="bg-secondary/5 border-secondary/20">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-secondary mb-1">{t("Search Interpretation", "Tafsiran Carian")}</h3>
              <p className="text-sm text-foreground">{results.interpretation}</p>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {results.results?.sort((a: any, b: any) => (b.relevanceScore || 0) - (a.relevanceScore || 0)).map((r: any, i: number) => (
              <Card key={i} className="hover:border-secondary/30 transition-colors cursor-pointer" onClick={() => navigateToResult(r.type, r.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs ${TYPE_COLORS[r.type] || "bg-muted"}`}>
                          {mode === "bm" ? TYPE_LABELS[r.type]?.bm : TYPE_LABELS[r.type]?.en || r.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{t("Relevance", "Relevansi")}: {r.relevanceScore}/10</span>
                      </div>
                      <h4 className="text-sm font-medium text-foreground">{r.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.snippet}</p>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {results.suggestedQueries?.length > 0 && (
            <Card className="bg-muted/20">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">{t("Related Searches", "Carian Berkaitan")}</h3>
                <div className="flex flex-wrap gap-2">
                  {results.suggestedQueries.map((sq: string, i: number) => (
                    <Badge key={i} variant="outline" className="cursor-pointer hover:bg-secondary/10" onClick={() => { setQuery(sq); }}>
                      {sq}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
