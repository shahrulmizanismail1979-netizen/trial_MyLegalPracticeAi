import React from "react";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // A simple markdown renderer that preserves whitespace and handles basic bold/italic/lists
  
  const formatText = (text: string) => {
    // This is a naive implementation for simple rendering without external libraries
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/### (.*)/g, '<h3 class="text-lg font-bold mt-4 mb-2 font-serif text-primary/90">$1</h3>')
      .replace(/## (.*)/g, '<h2 class="text-xl font-bold mt-5 mb-3 font-serif text-foreground">$1</h2>')
      .replace(/# (.*)/g, '<h1 class="text-2xl font-bold mt-6 mb-4 font-serif text-primary">$1</h1>')
      .replace(/^- (.*)/gm, '<li class="ml-4 list-disc marker:text-primary/50">$1</li>');

    return { __html: formatted };
  };

  return (
    <div className="prose prose-invert max-w-none text-foreground/90 space-y-4 leading-relaxed whitespace-pre-wrap">
      {content.split('\n\n').map((paragraph, idx) => (
        <div 
          key={idx} 
          dangerouslySetInnerHTML={formatText(paragraph)} 
          className={paragraph.startsWith('- ') ? 'pl-2' : ''}
        />
      ))}
    </div>
  );
}
