/**
 * Contract test: the shared api-client's response interceptor must fire for
 * error responses too — in particular a 429 — so portals that wire their
 * rate-limit warning through `setResponseInterceptor` (e.g. MyConveyLitAI)
 * still show the "limit reached" banner when the very first thing a lawyer
 * sees is the block.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  customFetch,
  setResponseInterceptor,
  ApiError,
} from "../../../../lib/api-client-react/src/custom-fetch";

afterEach(() => {
  setResponseInterceptor(null);
  vi.unstubAllGlobals();
});

function stubFetch(response: Response) {
  vi.stubGlobal("fetch", vi.fn(async () => response));
}

describe("api-client response interceptor", () => {
  it("fires on successful responses with rate-limit headers readable", async () => {
    const seen: Array<string | null> = [];
    setResponseInterceptor((res) => seen.push(res.headers.get("RateLimit")));
    stubFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          RateLimit: '"60-in-1min"; r=42; t=31',
        },
      }),
    );

    await customFetch("/api/test");
    expect(seen).toEqual(['"60-in-1min"; r=42; t=31']);
  });

  it("fires on a 429 BEFORE the error is thrown, so remaining=0 is observable", async () => {
    const seen: Array<{ status: number; rl: string | null }> = [];
    setResponseInterceptor((res) =>
      seen.push({ status: res.status, rl: res.headers.get("RateLimit") }),
    );
    stubFetch(
      new Response(JSON.stringify({ error: "Too many AI requests." }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          RateLimit: '"60-in-1min"; r=0; t=17',
        },
      }),
    );

    await expect(customFetch("/api/ai/test", { method: "POST", body: "{}" })).rejects.toThrow(
      ApiError,
    );
    expect(seen).toEqual([{ status: 429, rl: '"60-in-1min"; r=0; t=17' }]);
  });

  it("a throwing interceptor never breaks the request path", async () => {
    setResponseInterceptor(() => {
      throw new Error("interceptor bug");
    });
    stubFetch(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(customFetch("/api/test")).resolves.toEqual({ ok: true });
  });
});
