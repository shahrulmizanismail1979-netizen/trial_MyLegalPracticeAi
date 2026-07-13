import { useState, useCallback } from "react";

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
        throw new Error("Failed to connect to AI tools");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      setMessages((prev) => [...prev, { role: "ai", content: "" }]);

      let buffer = "";
      let streamDone = false;
      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setError(parsed.error);
              streamDone = true;
              break;
            }
            if (parsed.done) { streamDone = true; break; }
            const chunk = parsed.content ?? "";
            if (chunk) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "ai") {
                  updated[updated.length - 1] = { ...last, content: last.content + chunk };
                }
                return updated;
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      }
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data !== "[DONE]") {
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "ai") {
                    updated[updated.length - 1] = { ...last, content: last.content + parsed.content };
                  }
                  return updated;
                });
              }
            } catch { /* ignore */ }
          }
        }
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
