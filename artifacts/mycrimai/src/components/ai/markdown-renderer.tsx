import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

export function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`space-y-3 ${className || ""}`}>
      {content && <DraftExportButtons title="AI Draft" content={content} hideMarkdown />}
      <DraftDocument content={content} />
    </div>
  );
}
