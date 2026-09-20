import { DraftDocument } from "@workspace/draft-export/react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return <DraftDocument content={content} />;
}
