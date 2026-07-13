import { useMemo } from "react";

function parseMarkdown(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-serif font-bold mt-6 mb-2 text-foreground">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-serif font-bold mt-8 mb-3 text-foreground border-b border-border/50 pb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-serif font-bold mt-8 mb-4 text-foreground">$1</h1>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em class="italic text-muted-foreground">$1</em>');
  html = html.replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-primary">$1</code>');

  html = html.replace(/^[-•] (.+)$/gm, '<li class="ml-4 mb-1 list-disc list-inside text-muted-foreground">$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 mb-1 list-decimal list-inside text-muted-foreground">$1. $2</li>');

  html = html.replace(/\n{2,}/g, '</p><p class="mb-3 leading-relaxed text-muted-foreground">');

  html = `<p class="mb-3 leading-relaxed text-muted-foreground">${html}</p>`;
  html = html.replace(/<p class="mb-3 leading-relaxed text-muted-foreground">(<h[123])/g, "$1");
  html = html.replace(/(<\/h[123]>)<\/p>/g, "$1");
  html = html.replace(/<p class="mb-3 leading-relaxed text-muted-foreground">(<li)/g, "$1");
  html = html.replace(/(<\/li>)<\/p>/g, "$1");
  html = html.replace(/<p class="mb-3 leading-relaxed text-muted-foreground"><\/p>/g, "");

  return html;
}

export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const html = useMemo(() => parseMarkdown(content), [content]);
  return (
    <div
      className={`prose-custom ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
