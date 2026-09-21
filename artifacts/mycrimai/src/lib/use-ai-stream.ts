import { useState, useCallback, useRef } from "react";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";

interface UseAiStreamOptions {
  onComplete?: (fullText: string) => void;
}

export function useAiStream(options?: UseAiStreamOptions) {
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      setResponse("");
      setError(null);
      setIsComplete(false);
      setIsStreaming(true);

      abortRef.current = new AbortController();

      try {
        const apiUrl = `/api/crim${url}`;

        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
          credentials: "include",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 429) emitRateLimit(0);
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const rl = readRateLimitRemaining(res);
        if (rl !== null) emitRateLimit(rl);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";
        let sawDone = false;

        const processLine = (line: string) => {
          if (!line.startsWith("data:")) return;

          let data: { done?: boolean; complete?: boolean; content?: string; error?: string };
          try {
            data = JSON.parse(line.slice(5).trim());
          } catch {
            throw new Error("The AI response was malformed. Please try again.");
          }

          if (data.error) throw new Error(data.error);
          if (data.done) {
            if (data.complete === false) {
              throw new Error("The AI response stopped before completion. Please try again.");
            }
            sawDone = true;
            setIsComplete(true);
            options?.onComplete?.(fullText);
          } else if (data.content) {
            fullText += data.content;
            setResponse(fullText);
          }
        };

        while (!sawDone) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              processLine(line);
            }
          }
        }

        buffer += decoder.decode();
        if (!sawDone && buffer.trim()) {
          const lines = buffer.split("\n");
          for (const line of lines) {
            processLine(line);
          }
        }
        if (!sawDone) {
          throw new Error("The AI connection ended before completion. Partial output cannot be saved or exported; please try again.");
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Stream failed");
        } else {
          setError("Generation was cancelled. Partial output cannot be saved or exported.");
        }
        setIsComplete(false);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [options]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setResponse("");
    setError(null);
    setIsComplete(false);
  }, []);

  return { response, isStreaming, isComplete, error, stream, cancel, reset };
}
