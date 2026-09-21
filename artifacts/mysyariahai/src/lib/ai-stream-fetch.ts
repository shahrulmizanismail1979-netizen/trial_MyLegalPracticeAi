/**
 * Thin fetch wrapper for MySyariahAI AI endpoints.
 * Reads the draft-8 `RateLimit` header from each response and emits
 * the value to the rate-limit event bus so the RateLimitWarning component
 * can surface a countdown to the user.
 */
import { emitRateLimit, readRateLimitRemaining } from "./rate-limit-bus";

export function enforceTerminalSse(res: Response): Response {
  if (!res.body || !res.headers.get("content-type")?.includes("text/event-stream")) return res;

  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;
  const body = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      buffer += decoder.decode(chunk, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const payload = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!payload) continue;
        try {
          const event = JSON.parse(payload) as { done?: boolean };
          if (event.done) terminal = true;
        } catch {
          throw new Error("The AI response was malformed. Please try again.");
        }
      }
    },
    flush() {
      buffer += decoder.decode();
      if (!terminal) {
        throw new Error("The AI connection ended before completion. Partial output cannot be saved or exported; please try again.");
      }
    },
  }));
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/**
 * Drop-in replacement for `fetch()` used on AI streaming endpoints.
 * On a 429 it emits 0 remaining before re-throwing, so the banner appears
 * even when the server body is consumed as an error.
 */
export async function aiStreamFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  // Only track AI quota for generation requests (POST/PUT).
  // Metadata GETs (list, categories, types) share some URL prefixes but do
  // not consume a meaningful AI quota slot, so we skip them to avoid showing
  // a misleading countdown after a simple page-load fetch.
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET") return res;

  if (res.status === 429) {
    emitRateLimit(0);
    return res;
  }

  const rl = readRateLimitRemaining(res);
  if (rl !== null) emitRateLimit(rl);

  return enforceTerminalSse(res);
}
