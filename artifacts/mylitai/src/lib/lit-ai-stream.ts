/**
 * Shared streaming helper for MyLitAI AI-generation endpoints.
 *
 * Reads the `RateLimit-Remaining` draft-8 header from every successful
 * response and emits the value to the portal-level rate-limit event bus,
 * so `RateLimitWarning` can display a countdown to the user.
 *
 * On HTTP 429 it emits 0 remaining, so the "limit reached" message fires
 * even though the body may never be read as a stream.
 */
import { emitRateLimit, readRateLimitRemaining } from "./rate-limit-bus";

export interface StreamOptions {
  /** Include cookies / session credentials. Default: true. */
  credentials?: RequestCredentials;
  /** Custom error message shown to the user when the server returns 402. */
  errorFor402?: string;
  /** AbortSignal for cancellation support. */
  signal?: AbortSignal;
}

/**
 * POST `body` to `endpoint` and stream SSE chunks via callbacks.
 *
 * The function reads `RateLimit-Remaining` from the response and forwards
 * it to the rate-limit event bus.  All existing call-sites keep the same
 * signature; pass `options` for credentials / 402 messages / abort.
 */
export async function litAiStream(
  endpoint: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: (disclaimer?: string) => void,
  onError: (msg: string) => void,
  options: StreamOptions = {},
): Promise<void> {
  const { credentials = "include", errorFor402, signal } = options;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    onError("Network error");
    return;
  }

  if (!response.ok) {
    if (response.status === 429) {
      emitRateLimit(0);
      const errData = await response.json().catch(() => ({}));
      onError(
        (errData as { error?: string }).error ||
          "Too many AI requests. Please try again shortly."
      );
      return;
    }
    if (response.status === 402 && errorFor402) {
      onError(errorFor402);
      return;
    }
    onError("Server error");
    return;
  }

  // Emit rate-limit remaining so the warning banner can update.
  const rl = readRateLimitRemaining(response);
  if (rl !== null) emitRateLimit(rl);

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) { onError("No stream"); return; }

  let buffer = "";
  let finished = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const data = JSON.parse(line.slice(6)) as {
          content?: string;
          done?: boolean;
          disclaimer?: string;
          error?: string;
        };
        if (data.error) { finished = true; onError(data.error); return; }
        if (data.done) { finished = true; onDone(data.disclaimer); return; }
        if (data.content) onChunk(data.content);
      } catch { /* ignore partial JSON */ }
    }
  }

  if (!finished) onDone();
}
