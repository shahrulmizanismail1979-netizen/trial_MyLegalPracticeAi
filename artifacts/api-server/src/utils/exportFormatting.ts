export type ExportInline = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
};

export type ExportLine = {
  kind: "blank" | "heading" | "bullet" | "numbered" | "paragraph";
  level?: number;
  marker?: string;
  runs: ExportInline[];
};

/** Presentation-only Markdown normalisation. Source strings are never mutated. */
export function normalizeExportInline(value: string): ExportInline[] {
  const runs: ExportInline[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const plain = (text: string) => {
    const cleaned = text.replace(/\*/g, "");
    if (cleaned) runs.push({ text: cleaned });
  };

  while ((match = pattern.exec(value))) {
    plain(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      runs.push({ text: token.slice(2, -2).replace(/\*/g, ""), bold: true });
    } else if (token.startsWith("__")) {
      runs.push({ text: token.slice(2, -2).replace(/\*/g, ""), bold: true });
    } else if (token.startsWith("`")) {
      runs.push({ text: token.slice(1, -1).replace(/\*/g, ""), code: true });
    } else {
      runs.push({ text: token.slice(1, -1).replace(/\*/g, ""), italics: true });
    }
    cursor = match.index + token.length;
  }
  plain(value.slice(cursor));
  return runs.length ? runs : [{ text: "" }];
}

export function normalizeExportLines(content: string): ExportLine[] {
  return content.replace(/\r\n?/g, "\n").split("\n").map((raw) => {
    const line = raw.trimEnd();
    const compact = line.trim().replace(/\s+/g, "");
    if (!line.trim() || (compact.length >= 3 && /^[-*_=─—–]+$/.test(compact))) {
      return { kind: "blank", runs: [{ text: "" }] };
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      return {
        kind: "heading",
        level: heading[1].length,
        runs: normalizeExportInline(heading[2]),
      };
    }

    const bullet = line.match(/^\s*[-*•]\s+(.+)$/);
    if (bullet) return { kind: "bullet", runs: normalizeExportInline(bullet[1]) };

    const numbered = line.match(/^\s*(\d+\.|\([a-zivx]+\))\s+(.+)$/i);
    if (numbered) {
      return {
        kind: "numbered",
        marker: numbered[1],
        runs: normalizeExportInline(numbered[2]),
      };
    }

    return { kind: "paragraph", runs: normalizeExportInline(line) };
  });
}

export function exportPlainText(value: string): string {
  return normalizeExportInline(value).map((run) => run.text).join("");
}