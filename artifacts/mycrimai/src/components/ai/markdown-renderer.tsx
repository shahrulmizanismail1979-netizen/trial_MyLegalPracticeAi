import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

export function MarkdownRenderer({ content, className, exportReady = true }: { content: string; className?: string; exportReady?: boolean }) {
  return (
    <div className={`space-y-3 ${className || ""}`}>
      {content && exportReady && <DraftExportButtons title="AI Draft" content={content} hideMarkdown />}
      <DraftDocument content={content} />
    </div>
  );
}
