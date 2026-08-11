import { useState } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export function useStreamingChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (question: string, context?: string) => {
    if (!question.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsStreaming(true);
    setError(null);
    
    // Add empty model message to append chunks to
    setMessages(prev => [...prev, { role: 'model', content: '' }]);

    try {
      const response = await fetch('/api/lit/ai/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          emitRateLimit(0);
        }
        throw new Error(errData.error || 'Failed to connect to AI Tutor');
      }

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

  const clearChat = () => setMessages([]);

  return { messages, sendMessage, isStreaming, error, clearChat };
}
