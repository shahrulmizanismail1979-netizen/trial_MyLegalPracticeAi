export interface SseEvent {
  content?: string;
  error?: string;
  done?: boolean;
  [k: string]: unknown;
}

export interface ConsumeSseOptions {
  onEvent: (e: SseEvent) => void;
  onError?: (msg: string) => void;
  signal?: AbortSignal;
}

/**
 * Consume an SSE response body, correctly buffering across chunk boundaries.
 * Frames are delimited by a blank line (\n\n). Lines starting with "data: "
 * are concatenated (per SSE spec) and JSON.parse'd as a single event.
 *
 * Returns when the stream ends, the abort signal fires, or an error event arrives.
 */
export async function consumeSse(res: Response, opts: ConsumeSseOptions): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream body");
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  let streamError: string | null = null;

  const flushFrame = (frame: string) => {
    const dataLines: string[] = [];
    for (const rawLine of frame.split("\n")) {
      const line = rawLine.replace(/\r$/, "");
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    try {
      const parsed = JSON.parse(payload) as SseEvent;
      opts.onEvent(parsed);
      if (parsed.done) terminal = true;
      if (parsed.error) {
        streamError = parsed.error;
        opts.onError?.(parsed.error);
      }
    } catch {
      streamError = "The AI response was malformed and was not marked complete. Please try again.";
      opts.onError?.(streamError);
    }
  };

  try {
    while (true) {
      if (opts.signal?.aborted) {
        try { await reader.cancel(); } catch {}
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (frame.trim()) flushFrame(frame);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) flushFrame(buffer);
    if (streamError) throw new Error(streamError);
    if (!opts.signal?.aborted && !terminal) {
      const message = "The AI connection ended before completion. Partial output cannot be saved or exported; please try again.";
      opts.onError?.(message);
      throw new Error(message);
    }
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}
