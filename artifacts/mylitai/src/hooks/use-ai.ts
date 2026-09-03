import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface LitConversation {
  id: number;
  title: string;
  matterId: number | null;
  createdAt: string;
}

async function conversationRequest(path = '', init?: RequestInit) {
  const response = await fetch(`/api/lit/gemini/litConversations${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to load discussion');
  }
  return response;
}

export function useStreamingChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversation = async (id: number) => {
    setIsLoadingConversation(true);
    setError(null);
    try {
      const response = await conversationRequest(`/${id}`);
      const conversation = await response.json() as LitConversation & {
        litMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
      };
      setConversationId(conversation.id);
      setMessages(conversation.litMessages.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        content: message.content,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load discussion');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const sendMessage = async (question: string, matterId?: number | null) => {
    if (!question.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsStreaming(true);
    setError(null);

    // Add empty model message to append chunks to
    setMessages(prev => [...prev, { role: 'model', content: '' }]);

    try {
      let activeConversationId = conversationId;
      if (activeConversationId === null) {
        const createdResponse = await conversationRequest('', {
          method: 'POST',
          body: JSON.stringify({
            title: question.trim().slice(0, 300),
            ...(matterId ? { matterId } : {}),
          }),
        });
        const created = await createdResponse.json() as LitConversation;
        activeConversationId = created.id;
        setConversationId(created.id);
        await queryClient.invalidateQueries({ queryKey: ['lit-conversations'] });
      }

      const response = await conversationRequest(`/${activeConversationId}/litMessages`, {
        method: 'POST',
        body: JSON.stringify({ content: question }),
      });

      const rl = readRateLimitRemaining(response);
      if (rl !== null) emitRateLimit(rl);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No stream available');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.content) {
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content += data.content;
                  return newMessages;
                });
              }
            } catch (e) {
              console.error('Failed to parse stream chunk', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsStreaming(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  };

  return {
    messages,
    conversationId,
    sendMessage,
    loadConversation,
    isStreaming,
    isLoadingConversation,
    error,
    clearChat,
  };
}
