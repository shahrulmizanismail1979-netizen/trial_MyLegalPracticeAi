import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Trash2, X, Volume2, VolumeX, ChevronRight, FolderKanban, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useStreamingChat, type LitConversation } from '@/hooks/use-ai';
import { useMatters } from '@/hooks/use-matters';
import { Button, Input } from '@/components/ui';
import { speak, stop, isSupported, stripMarkdown } from '@/lib/tts';
import { useToast } from '@/hooks/use-toast';

async function discussionRequest(path = '', init?: RequestInit) {
  const response = await fetch(`/api/lit/gemini/litConversations${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update discussion');
  }
  return response.json();
}

// ─── Markdown renderer (no extra libs) ─────────────────────────────────────────
function MarkdownText({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="bg-background/60 text-primary/90 font-mono text-[0.8em] px-1 rounded">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];

    // H3
    if (line.startsWith('### ')) {
      elements.push(<h5 key={i} className="font-bold text-foreground mt-3 mb-1 text-sm">{line.slice(4)}</h5>);
      i++; continue;
    }
    // H2
    if (line.startsWith('## ')) {
      elements.push(<h4 key={i} className="font-bold text-foreground mt-4 mb-2 text-base">{line.slice(3)}</h4>);
      i++; continue;
    }
    // H1
    if (line.startsWith('# ')) {
      elements.push(<h3 key={i} className="font-bold text-foreground mt-4 mb-2 text-lg">{line.slice(2)}</h3>);
      i++; continue;
    }
    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const match = lines[i].match(/^(\d+)\.\s(.*)$/);
        if (match) {
          listItems.push(
            <li key={i} className="flex gap-2 items-start">
              <span className="text-primary font-bold shrink-0 min-w-[1.2rem]">{match[1]}.</span>
              <span>{renderInline(match[2])}</span>
            </li>
          );
        }
        i++;
      }
      elements.push(<ol key={`ol-${i}`} className="space-y-1.5 my-2">{listItems}</ol>);
      continue;
    }
    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* ') || lines[i].startsWith('• '))) {
        listItems.push(
          <li key={i} className="flex gap-2 items-start">
            <span className="text-primary/60 mt-1 shrink-0">•</span>
            <span>{renderInline(lines[i].slice(2))}</span>
          </li>
        );
        i++;
      }
      elements.push(<ul key={`ul-${i}`} className="space-y-1.5 my-2">{listItems}</ul>);
      continue;
    }
    // Horizontal rule
    if (line.match(/^---+$/) || line.match(/^===+$/)) {
      elements.push(<hr key={i} className="border-border my-3" />);
      i++; continue;
    }
    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
      i++; continue;
    }
    // Regular paragraph
    elements.push(<p key={i} className="mb-1 leading-relaxed">{renderInline(line)}</p>);
    i++;
  }

  return <div className="text-sm space-y-0">{elements}</div>;
}

// ─── TTS Button ─────────────────────────────────────────────────────────────────
function MessageTTS({ content }: { content: string }) {
  const [speaking, setSpeaking] = useState(false);
  // Stop speech on unmount (navigation, reset) so audio doesn't outlive the component
  useEffect(() => () => { if (speaking) stop(); }, [speaking]);
  if (!isSupported()) return null;
  const toggle = () => {
    if (speaking) { stop(); setSpeaking(false); }
    else { speak(stripMarkdown(content), () => setSpeaking(false)); setSpeaking(true); }
  };
  return (
    <button
      onClick={toggle}
      className={`mt-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
        speaking ? 'text-primary border-primary/40 bg-primary/5' : 'text-muted-foreground border-border/50 bg-transparent hover:text-primary'
      }`}
      title="Listen to response"
    >
      {speaking ? <VolumeX className="h-2.5 w-2.5" /> : <Volume2 className="h-2.5 w-2.5" />}
      {speaking ? 'Stop' : 'Listen'}
    </button>
  );
}

// ─── Starter suggestions ────────────────────────────────────────────────────────
const STARTER_QUESTIONS = [
  "Explain the Order for Sale procedure under Order 83 ROC 2012",
  "What are the grounds for resisting summary judgment under Order 14?",
  "How does indefeasibility of title work under s. 340 NLC?",
  "What documents are needed for a bankruptcy petition?",
  "Explain the difference between FSA 2013 and IFSA 2013",
  "What are the key steps in a foreclosure proceeding in Malaysia?",
  "How is stamp duty calculated on a loan agreement?",
  "Explain the concept of guarantor discharge under s. 86 Contracts Act",
];

// ─── Main AI Tutor Component ────────────────────────────────────────────────────
export function AITutor({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const {
    messages,
    conversationId,
    sendMessage,
    loadConversation,
    isStreaming,
    isLoadingConversation,
    error,
    clearChat,
  } = useStreamingChat();
  const { data: matters = [] } = useMatters();
  const { data: conversations = [] } = useQuery<LitConversation[]>({
    queryKey: ['lit-conversations'],
    queryFn: () => discussionRequest(),
    enabled: isOpen,
    staleTime: 15_000,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [selectedMatterId, setSelectedMatterId] = useState<number | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Listen for pre-fill events from Theory page
  useEffect(() => {
    const handler = (e: CustomEvent<{ question: string }>) => {
      setInput(e.detail.question);
      onClose(); // briefly close then reopen isn't needed
      // Just set the input - user can click send or modify
    };
    window.addEventListener('ai-prefill', handler as EventListener);
    return () => window.removeEventListener('ai-prefill', handler as EventListener);
  }, []);

  useEffect(() => {
    if (conversationId === null) return;
    const conversation = conversations.find((item) => item.id === conversationId);
    if (conversation) setSelectedMatterId(conversation.matterId);
  }, [conversationId, conversations]);

  const startNewDiscussion = () => {
    clearChat();
    setSelectedMatterId(null);
  };

  const selectConversation = async (id: number | null) => {
    if (id === null) {
      startNewDiscussion();
      return;
    }
    const conversation = conversations.find((item) => item.id === id);
    setSelectedMatterId(conversation?.matterId ?? null);
    await loadConversation(id);
  };

  const selectMatter = async (matterId: number | null) => {
    if (conversationId === null) {
      setSelectedMatterId(matterId);
      return;
    }
    if (matterId === null) return;
    setIsLinking(true);
    try {
      await discussionRequest(`/${conversationId}/matter`, {
        method: 'PATCH',
        body: JSON.stringify({ matterId }),
      });
      setSelectedMatterId(matterId);
      await queryClient.invalidateQueries({ queryKey: ['lit-conversations'] });
      toast({
        title: 'Discussion filed to matter',
        description: 'LAWYes will now show this discussion in the selected matter.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not file discussion',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setIsLinking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input, selectedMatterId);
    setInput('');
  };

  const handleStarter = (q: string) => {
    if (isStreaming) return;
    sendMessage(q, selectedMatterId);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <div className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[440px] border-l border-border bg-card shadow-2xl shadow-black/50 transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 bg-background/60 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-2 text-primary">
            <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-serif font-semibold text-base leading-none">AI Senior Counsel</h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Malaysian Litigation Practice</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={clearChat} title="Clear Chat" className="h-8 w-8">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="Close panel" className="h-8 w-8">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-border px-4 py-3 bg-background/40 shrink-0">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Discussion</span>
            <select
              aria-label="Discussion"
              value={conversationId ?? ''}
              onChange={(event) => void selectConversation(event.target.value ? Number(event.target.value) : null)}
              disabled={isStreaming || isLoadingConversation}
              className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs text-foreground"
            >
              <option value="">New discussion</option>
              {conversations.map((conversation) => (
                <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">File in matter</span>
            <div className="relative">
              <FolderKanban className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <select
                aria-label="File discussion in matter"
                value={selectedMatterId ?? ''}
                onChange={(event) => void selectMatter(event.target.value ? Number(event.target.value) : null)}
                disabled={isStreaming || isLoadingConversation || isLinking}
                className="w-full h-9 rounded-md border border-border bg-background pl-8 pr-2 text-xs text-foreground"
              >
                <option value="">
                  {conversationId === null ? 'Keep unlinked (private)' : 'Not linked to a matter'}
                </option>
                {matters.map((matter) => (
                  <option key={matter.id} value={matter.id}>{matter.title}</option>
                ))}
              </select>
              {isLinking && <Loader2 className="absolute right-2.5 top-2.5 h-3.5 w-3.5 animate-spin text-primary" />}
            </div>
          </label>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {error && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {isLoadingConversation && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}
          {!isLoadingConversation && messages.length === 0 ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground pt-6">
                <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">AI Senior Counsel</p>
                  <p className="text-sm mt-1">Ask any question on Malaysian litigation practice, procedure, case law, or document drafting across all areas.</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Suggested Questions</p>
                <div className="space-y-2">
                  {STARTER_QUESTIONS.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleStarter(q)}
                      disabled={isStreaming}
                      className="w-full text-left text-sm px-3 py-2.5 rounded-lg border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors flex items-center justify-between gap-2 group"
                    >
                      <span className="text-foreground group-hover:text-primary line-clamp-1">{q}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 border border-primary/30 text-primary'
                }`}>
                  {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                </div>
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm text-sm'
                      : 'bg-background text-foreground rounded-tl-sm border border-border/70 shadow-sm'
                  }`}>
                    {msg.role === 'user' ? (
                      <p className="text-sm">{msg.content}</p>
                    ) : (
                      <>
                        <MarkdownText content={msg.content} />
                        {isStreaming && idx === messages.length - 1 && (
                          <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-1 align-middle rounded-sm" />
                        )}
                      </>
                    )}
                  </div>
                  {msg.role === 'model' && !isStreaming && (
                    <MessageTTS content={msg.content} />
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-background/60 backdrop-blur-md shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about procedure, case law, documents..."
              className="flex-1 bg-background text-sm"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              aria-label="Send"
              disabled={isStreaming || isLoadingConversation || !input.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Verify all citations and advice against primary sources before professional use.
          </p>
        </div>
      </div>
    </>
  );
}
