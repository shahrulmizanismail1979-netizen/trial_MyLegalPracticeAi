import React from "react";
import { Citation } from "@/lib/irac-api";
import { BookOpen, ExternalLink } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function CitationsList({ citations }: { citations: Citation[] }) {
  const { t } = useLanguage();
  if (!citations || citations.length === 0) return null;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h4 className="text-sm font-serif font-semibold text-foreground mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-secondary" />
        {t("tool.citations.title")}
      </h4>
      <ul className="space-y-2">
        {citations.map((cit, idx) => (
          <li key={idx}>
            <a 
              href={cit.uri} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-secondary transition-colors group"
            >
              <ExternalLink className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
              <span className="underline decoration-primary/30 group-hover:decoration-secondary underline-offset-2">
                {cit.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
