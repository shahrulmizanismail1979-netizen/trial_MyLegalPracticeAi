import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WorkspaceLayout from "./layout";
import MarkdownRenderer from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, Plus, Send, Trash2, StopCircle, 
  User, Bot, Clock, AlertCircle, Loader2
} from "lucide-react";
import { isAuthenticated, getToken, authHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/api";
import { format } from "date-fns";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingResponse, setStreamingResponse] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  // Queries & Mutations
  const { data: conversations, isLoading: isLoadingConversations } = useQuery({
    queryKey: ["ccb-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/ccb/gemini/conversations", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json() as Promise<Array<{id:number;title:string;createdAt:string}>>;
    },
  });

  const { data: activeConversation, isLoading: isLoadingConversation } = useQuery({
    queryKey: ["ccb-conversation", activeConversationId],
    queryFn: async () => {
      const res = await fetch(`/api/ccb/gemini/conversations/${activeConversationId}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load conversation");
      return res.json() as Promise<{id:number;title:string;createdAt:string;messages:Array<{id:number;conversationId:number;role:string;content:string;createdAt:string}>}>;
    },
    enabled: !!activeConversationId,
  });

  const createConversation = useMutation({
    mutationFn: async (data: { title: string }) => {
      const res = await fetch("/api/ccb/gemini/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json() as Promise<{id:number;title:string;createdAt:string}>;
    },
  });
  const deleteConversation = useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      const res = await fetch(`/api/ccb/gemini/conversations/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
  });

  // Set active conversation if none selected but available
  useEffect(() => {
    if (!activeConversationId && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeConversation?.messages, streamingResponse, isGenerating]);

  const handleNewConversation = () => {
    createConversation.mutate({ title: "New Conversation" }, {
      onSuccess: (newConv) => {
        queryClient.invalidateQueries({ queryKey: ["ccb-conversations"] });
        setActiveConversationId(newConv.id);
      }
    });
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteConversation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["ccb-conversations"] });
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
        toast({ title: "Conversation deleted" });
      }
    });
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      // Invalidate to fetch the partial message saved by backend (if any) or to sync state
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ["ccb-conversation", activeConversationId] });
      }
      setStreamingResponse("");
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim() || !activeConversationId || isGenerating) return;

    const currentMessage = message;
    setMessage("");
    setIsGenerating(true);
    setStreamingResponse("");
    
    // Optimistically update UI to show user message immediately
    queryClient.setQueryData(["ccb-conversation", activeConversationId], (oldData: any) => {
      if (!oldData) return oldData;
      return {
        ...oldData,
        messages: [
          ...oldData.messages,
          { id: Date.now(), conversationId: activeConversationId, role: "user", content: currentMessage, createdAt: new Date().toISOString() }
        ]
      };
    });

    abortControllerRef.current = new AbortController();
    
    try {
      const token = getToken();
      const url = apiUrl(`gemini/conversations/${activeConversationId}/messages`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({ content: currentMessage }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                toast({
                  title: "Error",
                  description: data.error,
                  variant: "destructive"
                });
                setIsGenerating(false);
                return;
              }
              if (data.content) {
                fullResponse += data.content;
                setStreamingResponse(fullResponse);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
      
      // On complete, invalidate to get the canonical saved messages
      queryClient.invalidateQueries({ queryKey: ["ccb-conversation", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["ccb-conversations"] }); // Refresh titles if updated
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error("Send message error:", error);
        toast({
          title: "Message failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive"
        });
      }
      // Revert optimistic update or fetch fresh
      queryClient.invalidateQueries({ queryKey: ["ccb-conversation", activeConversationId] });
    } finally {
      setIsGenerating(false);
      setStreamingResponse("");
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // The most recent completed assistant answer, offered for filing into a matter.
  const lastAssistantMessage = activeConversation?.messages
    ?.slice()
    .reverse()
    .find((m) => m.role !== "user");

  return (
    <WorkspaceLayout>
      <div className="h-full flex overflow-hidden max-w-7xl mx-auto border-x border-border/50">
        
        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-muted/10 border-r border-border/50 hidden md:flex">
          <div className="p-4 border-b border-border/50">
            <Button 
              onClick={handleNewConversation} 
              className="w-full flex items-center justify-center gap-2"
              disabled={createConversation.isPending}
              data-testid="button-new-chat"
            >
              {createConversation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              New Conversation
            </Button>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoadingConversations ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg flex items-center gap-3">
                    <Skeleton className="w-4 h-4 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-2 w-1/2" />
                    </div>
                  </div>
                ))
              ) : conversations?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm flex flex-col items-center gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p>No conversations yet</p>
                </div>
              ) : (
                conversations?.map((conv) => (
                  <div 
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`
                      group p-3 rounded-lg cursor-pointer flex items-start gap-3 transition-colors
                      ${activeConversationId === conv.id ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted border border-transparent'}
                    `}
                    data-testid={`chat-item-${conv.id}`}
                  >
                    <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${activeConversationId === conv.id ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${activeConversationId === conv.id ? 'text-foreground' : 'text-foreground/80'}`}>
                        {conv.title || "New Conversation"}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {format(new Date(conv.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-background/50 min-w-0">
          {/* Mobile Header (active chat info) */}
          <div className="md:hidden p-3 border-b border-border/50 bg-card flex justify-between items-center">
             <span className="font-medium text-sm truncate">
               {activeConversation?.title || "Legal AI Chat"}
             </span>
             <Button variant="outline" size="sm" onClick={handleNewConversation} className="h-8">
               <Plus className="w-3.5 h-3.5 mr-1" /> New
             </Button>
          </div>

          <div 
            className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
            ref={scrollRef}
          >
            {!activeConversationId ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Legal AI Assistant</h2>
                <p className="max-w-md text-sm mb-6">
                  Your dedicated AI companion for Malaysian corporate, commercial, and banking litigation.
                </p>
                <Button onClick={handleNewConversation}>
                  Start a new conversation
                </Button>
              </div>
            ) : isLoadingConversation ? (
              <div className="space-y-6">
                <Skeleton className="h-20 w-3/4 ml-auto rounded-2xl rounded-tr-sm" />
                <Skeleton className="h-40 w-3/4 rounded-2xl rounded-tl-sm" />
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto pb-4">
                {activeConversation?.messages.length === 0 && !isGenerating ? (
                  <div className="text-center py-10">
                     <p className="text-muted-foreground text-sm">Send a message to start the conversation.</p>
                  </div>
                ) : (
                  <>
                    {activeConversation?.messages.map((msg) => (
                      <div 
                        key={msg.id} 
                        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role !== 'user' && (
                          <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div 
                          className={`
                            max-w-[85%] rounded-2xl px-5 py-4
                            ${msg.role === 'user' 
                              ? 'bg-primary text-primary-foreground rounded-tr-sm ml-auto' 
                              : 'bg-card border border-border/60 rounded-tl-sm'
                            }
                          `}
                        >
                          {msg.role === 'user' ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                          ) : (
                            <div className="text-sm">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {/* Streaming Response */}
                    {isGenerating && streamingResponse && (
                      <div className="flex gap-4 justify-start">
                        <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-card border border-border/60 rounded-tl-sm text-sm">
                          <MarkdownRenderer content={streamingResponse} />
                          <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse align-middle"></span>
                        </div>
                      </div>
                    )}
                    
                    {/* Loading Indicator (before stream starts) */}
                    {isGenerating && !streamingResponse && (
                      <div className="flex gap-4 justify-start">
                         <div className="w-8 h-8 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-1">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="px-5 py-4 flex items-center text-primary text-sm gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Thinking...
                        </div>
                      </div>
                    )}

                    {/* Save the latest AI answer into a matter file */}
                    {!isGenerating && lastAssistantMessage && (
                      <div className="ml-12">
                        <SaveToMatterPanel
                          key={lastAssistantMessage.id}
                          draftTitle={activeConversation?.title || "Legal AI Chat"}
                          draftContent={lastAssistantMessage.content}
                          kind="chat"
                          refPrefix="CCB"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-card border-t border-border mt-auto">
            <div className="max-w-4xl mx-auto relative">
              <form 
                onSubmit={handleSendMessage}
                className="flex items-end gap-2"
              >
                <div className="relative flex-1">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a legal question or provide context..."
                    className="pr-12 h-12 bg-background/50 border-border focus-visible:ring-primary/30 rounded-full"
                    disabled={isGenerating || !activeConversationId}
                    data-testid="input-chat-message"
                  />
                  {isGenerating ? (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-1 top-1 h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                      onClick={handleStop}
                      data-testid="button-stop-chat"
                    >
                      <StopCircle className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button 
                      type="submit" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute right-1 top-1 h-10 w-10 text-primary hover:text-primary hover:bg-primary/10 rounded-full"
                      disabled={!message.trim() || !activeConversationId}
                      data-testid="button-send-chat"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </form>
              <div className="text-center mt-2">
                <span className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                  <AlertCircle className="w-3 h-3" /> AI outputs may require verification by a qualified practitioner.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
