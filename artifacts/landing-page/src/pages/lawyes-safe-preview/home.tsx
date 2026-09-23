import { useState, useRef, useEffect } from "react";
import {
  Search, FileText, Briefcase, ArrowUp, ShieldAlert,
  Sparkles, Mic, MicOff, X,
  ChevronDown, MessageSquare, AlertCircle, FolderOpen,
  Plus
} from "lucide-react";
import type { RouterState } from "./use-router-state";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: { name: string; content?: string; type: 'text' | 'file' }[];
  error?: boolean;
};

const MODES = [
  { id: 'general', name: 'General Practice', icon: <MessageSquare size={16} /> },
  { id: 'research', name: 'Legal Research', icon: <Search size={16} /> },
  { id: 'drafting', name: 'Document Drafting', icon: <FileText size={16} /> },
  { id: 'analysis', name: 'Case Analysis', icon: <Briefcase size={16} /> },
];

function renderMessageContent(text: string) {
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.trim() === '') return <div key={i} className="h-2" />;
    const isBullet = line.trim().match(/^(-\s|\d+\.\s|\*\s)/);
    const body = isBullet ? line.trim().replace(/^(-\s|\d+\.\s|\*\s)/, '') : line;
    const parts = body.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j} className="font-semibold text-foreground">{part}</strong> : <span key={j}>{part}</span>
    );
    return isBullet ? <li key={i} className="ml-4 list-disc marker:text-muted-foreground my-1">{rendered}</li> : <p key={i} className="my-1.5 leading-relaxed">{rendered}</p>;
  });
}

function ModeSelector({ selectedMode, setSelectedMode }: { selectedMode: typeof MODES[0], setSelectedMode: (m: typeof MODES[0]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
       <button
         type="button"
         onClick={() => setOpen(!open)}
         className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-transparent hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
         aria-haspopup="listbox"
         aria-expanded={open}
         data-testid="button-mode-selector"
       >
          {selectedMode.icon}
          <span>{selectedMode.name}</span>
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
       </button>
       {open && (
         <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border shadow-lg rounded-xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2" role="listbox">
            {MODES.map(mode => (
              <button
                key={mode.id}
                role="option"
                aria-selected={selectedMode.id === mode.id}
                type="button"
                onClick={() => { setSelectedMode(mode); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors ${selectedMode.id === mode.id ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
              >
                 {mode.icon}
                 {mode.name}
              </button>
            ))}
         </div>
       )}
    </div>
  );
}

export function HomeView({ state, navigate }: { state: RouterState; navigate: (view: "search" | "draft" | "matter" | "practice" | "skills", params?: Partial<RouterState>) => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [q, setQ] = useState(state.q || "");
  const [selectedMode, setSelectedMode] = useState(MODES[0]);
  const [attachments, setAttachments] = useState<{name: string, content?: string, type: 'text' | 'file'}[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [streaming, setStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (e: any) => {
      let finalTranscript = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
              finalTranscript += e.results[i][0].transcript;
          }
      }
      if (finalTranscript) {
        setQ(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 300)}px`;
    }
  }, [q]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: typeof attachments = [];

    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['txt', 'md', 'csv', 'json'].includes(ext || '')) {
        if (file.size > 200000) {
          alert(`File ${file.name} is too large. Please limit text files to 200KB.`);
          continue;
        }
        const content = await file.text();
        newAttachments.push({ name: file.name, type: 'text', content });
      } else {
        newAttachments.push({ name: file.name, type: 'file' });
      }
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const hasSubmittableContent =
    Boolean(q.trim()) || attachments.some((attachment) => attachment.type === "text" && attachment.content);

  const submitMessage = async () => {
    if (!hasSubmittableContent) return;
    if (streaming) return;

    const newId = Date.now().toString();
    const userMsg: Message = {
      id: newId,
      role: 'user',
      content: q,
      attachments: attachments
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setQ('');
    setAttachments([]);

    const payloadMessages = newMessages.map((m, idx) => {
       let content = m.content;
       if (idx === newMessages.length - 1 && selectedMode.id !== 'general') {
          content = `[Mode: ${selectedMode.name}]\n${content}`;
       }
       if (m.attachments && m.attachments.length > 0) {
          const validAtts = m.attachments.filter(a => a.type === 'text' && a.content);
          if (validAtts.length > 0) {
            const attachmentsText = validAtts.map(a => `--- FILE: ${a.name} ---\n${a.content}\n--- END FILE ---`).join('\n\n');
            content += `\n\n${attachmentsText}`;
          }
       }
       return { role: m.role, content };
    });

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      const res = await fetch('/api/assistant/work-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages })
      });

      if (!res.ok) {
        throw new Error(
          res.status === 429
            ? "You are sending messages too quickly. Please wait a moment and try again."
            : "The LAWYes work assistant could not be reached.",
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No readable stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim().startsWith('data: ')) continue;
          const dataStr = event.slice(6);
          if (dataStr === '[DONE]') continue;

          let data: { content?: string; error?: string; done?: boolean };
          try {
            data = JSON.parse(dataStr);
          } catch {
            continue;
          }
          if (data.error) throw new Error(data.error);
          if (data.content) {
            assistantText += data.content;
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantText } : m));
          }
        }
      }
      if (!assistantText) throw new Error("No reply received");
    } catch (err: any) {
       setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: 'Error: ' + err.message, error: true } : m));
    } finally {
       setStreaming(false);
    }
  };

  const renderComposer = (isActive: boolean) => {
    return (
      <div className={`w-full max-w-3xl mx-auto ${isActive ? 'shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-background/80 backdrop-blur-sm sticky bottom-0 z-20' : 'mt-6'}`}>
        <form
          onSubmit={(e) => { e.preventDefault(); submitMessage(); }}
          className="w-full bg-card border border-border shadow-md rounded-2xl flex flex-col relative focus-within:ring-2 focus-within:ring-primary/20 transition-all focus-within:border-primary/40"
          aria-label="Legal instruction composer"
          data-testid="lawyes-instruction-composer"
        >
          {attachments.length > 0 && (
            <div className="flex px-4 pt-3 pb-1 gap-2 flex-wrap max-h-32 overflow-y-auto no-scrollbar">
              {attachments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs shadow-sm group">
                  {a.type === 'text' ? <FileText size={14} className="text-primary" /> : <Briefcase size={14} className="text-muted-foreground" />}
                  <span className="max-w-[120px] truncate font-medium text-foreground">{a.name}</span>
                  <button type="button" onClick={() => removeAttachment(i)} aria-label={`Remove ${a.name}`} className="ml-1 text-muted-foreground hover:text-destructive transition-colors focus:outline-none focus:ring-2 focus:ring-destructive/50 rounded-sm">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {attachments.some(a => a.type === 'file') && (
                <div className="w-full mt-1.5 mb-1 text-[11px] text-muted-foreground flex items-center gap-1.5 p-2 bg-muted/50 rounded-md border border-border/50">
                  <ShieldAlert size={12} className="shrink-0 text-primary" />
                  <span>Secure document analysis continues in My Matters. <a href="/lawyes" className="font-semibold text-primary hover:underline ml-0.5">Open workspace &rarr;</a></span>
                </div>
              )}
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitMessage();
              }
            }}
            className="w-full resize-none outline-none px-4 py-3 text-[15px] bg-transparent text-foreground placeholder:text-muted-foreground min-h-[56px] max-h-[300px] leading-relaxed"
            placeholder="Describe your legal issue, ask a question, or draft a document..."
            data-testid="input-lawyes-instruction"
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".txt,.md,.csv,.json,.pdf,.doc,.docx"
              />
              <button type="button" onClick={triggerFileSelect} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20" title="Attach files" aria-label="Attach files" data-testid="button-attach-file">
                 <Plus size={18} />
              </button>
              <button
                type="button"
                onClick={toggleListen}
                className={`p-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${isListening ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                title={speechSupported ? (isListening ? "Stop listening" : "Dictate") : "Voice input not supported in this browser"}
                aria-label={speechSupported ? (isListening ? "Stop voice dictation" : "Start voice dictation") : "Voice input not supported"}
                disabled={!speechSupported}
                data-testid="button-dictate"
              >
                 {isListening ? <MicOff size={18} className="animate-pulse" /> : <Mic size={18} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={streaming || !hasSubmittableContent}
              className="w-9 h-9 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 shrink-0 shadow-sm"
              aria-label="Submit legal instruction"
              data-testid="button-submit-instruction"
            >
               <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        </form>

        {!isActive && (
          <>
            {/* Starters and Recent Work */}
            <div className="w-full mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 px-1 animate-in fade-in slide-in-from-bottom-4">
               <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 px-1">
                     <Sparkles size={12} /> Quick Actions
                  </div>
                  <div className="flex flex-col">
                     <button onClick={() => navigate("search")} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 text-sm text-left group transition-all focus:outline-none focus:ring-2 focus:ring-primary/20" data-testid="button-action-search">
                        <div className="flex items-center gap-3">
                           <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><Search size={14} /></div>
                           <span className="font-medium text-foreground group-hover:text-primary transition-colors">Search Law &amp; Cases</span>
                        </div>
                     </button>
                     <button onClick={() => navigate("draft")} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 text-sm text-left group transition-all focus:outline-none focus:ring-2 focus:ring-primary/20" data-testid="button-action-draft">
                        <div className="flex items-center gap-3">
                           <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><FileText size={14} /></div>
                           <span className="font-medium text-foreground group-hover:text-primary transition-colors">Draft a Document</span>
                        </div>
                     </button>
                     <button onClick={() => navigate("matter")} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 text-sm text-left group transition-all focus:outline-none focus:ring-2 focus:ring-primary/20" data-testid="button-action-matter">
                        <div className="flex items-center gap-3">
                           <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><Briefcase size={14} /></div>
                           <span className="font-medium text-foreground group-hover:text-primary transition-colors">Prepare a matter</span>
                        </div>
                     </button>
                  </div>
               </div>

               <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 px-1">
                     <FolderOpen size={12} /> Recent Work
                  </div>
                  <div className="p-5 rounded-xl border border-border bg-card/50 flex flex-col gap-4 h-[calc(100%-2rem)]">
                     <p className="text-[13px] text-muted-foreground leading-relaxed">
                       Sign in to access your recent matters, saved documents, and continued conversations.
                     </p>
                     <div className="mt-auto pt-2 flex flex-col items-start gap-3">
                        <a href="/sign-in" className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                           Sign In
                        </a>
                     </div>
                  </div>
               </div>
            </div>
          </>
        )}

        {isActive && (
          <div className="mt-3 text-center flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground" data-testid="status-safe-preview-demonstration">
            <ShieldAlert size={12} />
            <span>Demonstration workspace — conversations are not saved to your account</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex w-full relative bg-background text-foreground" data-testid="lawyes-conversation-canvas">
       <div className="flex-1 flex flex-col min-w-0 h-full relative">

         <div className="h-14 border-b border-border flex items-center px-4 justify-between shrink-0 bg-background/80 backdrop-blur-md z-30 sticky top-0">
            <ModeSelector selectedMode={selectedMode} setSelectedMode={setSelectedMode} />
         </div>

         <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth flex flex-col" ref={scrollRef}>
            {messages.length === 0 ? (
               <div className="flex-1 flex flex-col justify-center items-center w-full max-w-4xl mx-auto px-4 py-8 md:py-12 min-h-min">
                  <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground text-center flex items-center justify-center gap-2">
                    <ShieldAlert size={14} className="text-primary" />
                    <span>Malaysia-wide legal work &middot; Sarawak Specialization</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-serif text-foreground text-center tracking-tight leading-tight max-w-2xl">
                    How can I assist your practice today?
                  </h1>

                  {renderComposer(false)}
               </div>
            ) : (
                <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto">
                   <div className="flex-1 px-4 py-8 flex flex-col gap-6">
                      {messages.map((m, messageIndex) => (
                       <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-2xl px-5 py-4 ${
                           m.role === 'user'
                            ? 'max-w-[90%] md:max-w-[85%] bg-muted/50 text-foreground border border-border rounded-tr-sm shadow-sm'
                            : 'w-full max-w-full bg-muted/40 text-foreground border border-border shadow-sm rounded-tl-sm'
                         }`}>
                            {m.role === 'assistant' && (
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                  <Sparkles size={12} />
                                </div>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">LAWYes</span>
                              </div>
                            )}
                            {m.attachments && m.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-3">
                                {m.attachments.map((a, i) => (
                                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-muted-foreground shadow-sm">
                                     {a.type === 'text' ? <FileText size={14} className="text-primary" /> : <Briefcase size={14} />}
                                     <span className="truncate max-w-[150px] font-medium">{a.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                             {m.role === "assistant" ? (
                               <DraftDocument content={m.content} />
                             ) : (
                               <div className="text-[15px] prose-p:my-2 prose-ul:my-2 prose-li:my-1">{renderMessageContent(m.content)}</div>
                             )}
                            {m.role === 'assistant' && m.content === '' && streaming && (
                              <div className="flex items-center gap-1 h-6 mt-2">
                                 <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                 <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                 <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            )}
                            {m.error && <div className="mt-3 text-sm text-destructive flex items-center gap-1.5 bg-destructive/10 p-2 rounded-md"><AlertCircle size={14} /> Failed to generate response</div>}
                             {m.role === "assistant" &&
                               m.content &&
                               !m.error &&
                               !(streaming && messageIndex === messages.length - 1) && (
                                 <DraftExportButtons
                                   title={`${selectedMode.name} response`}
                                   content={m.content}
                                   className="mt-4 border-t border-border/60 pt-3"
                                 />
                               )}
                         </div>
                       </div>
                     ))}
                  </div>
                  {renderComposer(true)}
               </div>
            )}
         </div>
       </div>
    </div>
  );
}
