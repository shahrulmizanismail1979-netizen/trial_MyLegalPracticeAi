import { useState, useCallback, useRef } from "react";

interface UseAiStreamOptions {
  onComplete?: (fullText: string) => void;
}

export function useAiStream(options?: UseAiStreamOptions) {
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(
    async (url: string, body: Record<string, unknown>) => {
      setResponse("");
      setError(null);
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
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.done) {
                    options?.onComplete?.(fullText);
                  } else if (data.content) {
                    fullText += data.content;
                    setResponse(fullText);
                  } else if (data.error) {
                    setError(data.error);
                  }
                } catch {}
              }
            }
          }
        }

        if (buffer.trim()) {
          const lines = buffer.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.done) {
                  options?.onComplete?.(fullText);
                } else if (data.content) {
                  fullText += data.content;
                  setResponse(fullText);
                } else if (data.error) {
                  setError(data.error);
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          setError(err.message || "Stream failed");
        }
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
  }, []);

  return { response, isStreaming, error, stream, cancel, reset };
}
