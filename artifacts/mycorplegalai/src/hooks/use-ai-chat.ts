import { useState, useCallback } from "react";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";

type AiTool = "tutor" | "drafter" | "risk-scanner" | "checklist" | "deadline-calculator" | "document-analyzer" | "case-finder" | "minutes-drafter" | "contract-review" | "compliance-advisor";

export interface AiMessage {
  role: "user" | "ai";
  content: string;
}

export function useAiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    tool: AiTool,
    message: string,
    context?: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: message }]);

      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/corp/legal/ai-tools/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ tool, message, context }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) emitRateLimit(0);
        throw new Error(errData.error || "Failed to connect to AI tools");
      }

      const rl = readRateLimitRemaining(response);
      if (rl !== null) emitRateLimit(rl);

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      setMessages((prev) => [...prev, { role: "ai", content: "" }]);

      let buffer = "";
      let sawDone = false;

      const appendContent = (content: string) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "ai") {
            updated[updated.length - 1] = { ...last, content: last.content + content };
          }
          return updated;
        });
      };

      const processEvent = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s?/, ""))
          .join("\n")
          .trim();
        if (!data) return;
        if (data === "[DONE]") {
          sawDone = true;
          return;
        }

        let parsed: { content?: string; error?: string; done?: boolean; complete?: boolean };
        try {
          parsed = JSON.parse(data);
        } catch {
          throw new Error("The AI response was malformed. No response has been marked as complete.");
        }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) appendContent(parsed.content);
        if (parsed.done) {
          sawDone = parsed.complete !== false;
          if (parsed.complete === false) {
            throw new Error("The AI response stopped before the draft was complete. Please generate it again.");
          }
        }
      };

      while (!sawDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          processEvent(event);
          if (sawDone) break;
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        processEvent(buffer);
      }
      if (!sawDone) {
        throw new Error("The AI connection ended before the draft was complete. Please generate it again.");
      }
      reader.cancel().catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, sendMessage, isLoading, error, clearMessages };
}
