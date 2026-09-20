import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {content && <DraftExportButtons title="AI Draft" content={content} hideMarkdown />}
      <DraftDocument content={content} />
    </div>
  );
}
