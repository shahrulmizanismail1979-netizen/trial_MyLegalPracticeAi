import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm md:prose-base prose-stone max-w-none dark:prose-invert 
      prose-headings:font-serif prose-headings:font-semibold prose-headings:text-primary 
      prose-a:text-secondary prose-a:no-underline hover:prose-a:underline
      prose-strong:text-foreground prose-strong:font-bold
      ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
