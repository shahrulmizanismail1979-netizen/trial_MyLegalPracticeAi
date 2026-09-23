import { beforeEach, describe, expect, it, vi } from "vitest";

const { proxyFetch, listConnections } = vi.hoisted(() => ({
  proxyFetch: vi.fn(),
  listConnections: vi.fn(),
}));

vi.mock("@replit/connectors-sdk", () => ({
  ReplitConnectors: class {
    listConnections = listConnections;
    createProxyFetch(name: string) {
      expect(name).toBe("perplexity");
      return proxyFetch;
    }
  },
}));
vi.mock("@workspace/integrations-gemini-ai", () => ({ ai: { models: {} } }));
vi.mock("@workspace/db", () => ({ db: {}, litAppSettings: {} }));
vi.mock("../../lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { generateChat, perplexityConfigured, streamChat } from "./aiProvider";

const messages = [{ role: "user" as const, text: "Synthetic QA input" }];
const options = { provider: "perplexity" as const, maxOutputTokens: 64 };
const source = "https://example.org/authority";
const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;

function streaming(body: string) {
  // Deliberately split SSE frames across byte chunks.
  const bytes = new TextEncoder().encode(body);
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  }), { headers: { "Content-Type": "text/event-stream" } });
}

async function collect() {
  const pieces = [];
  for await (const piece of streamChat(messages, options)) pieces.push(piece);
  return pieces;
}

beforeEach(() => {
  proxyFetch.mockReset();
  listConnections.mockReset();
});

describe("connector-backed Perplexity", () => {
  it("discovers the connection and fails closed when discovery fails or is empty", async () => {
    listConnections.mockResolvedValueOnce([{ connector_name: "perplexity" }])
      .mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("unavailable"));
    expect(await perplexityConfigured()).toBe(true);
    expect(await perplexityConfigured()).toBe(false);
    expect(await perplexityConfigured()).toBe(false);
    expect(listConnections).toHaveBeenCalledWith({ connector_names: "perplexity" });
  });

  it("uses managed authentication and preserves request options, text and deduplicated citations", async () => {
    proxyFetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: "QA_OK" } }],
      search_results: [{ title: "Authority", url: source }], citations: [source],
    }), { headers: { "Content-Type": "application/json" } }));
    await expect(generateChat(messages, options)).resolves.toEqual({
      text: "QA_OK", citations: [{ title: "Authority", uri: source }],
    });
    const [url, init] = proxyFetch.mock.calls[0];
    expect(String(url)).toBe("https://api.perplexity.ai/chat/completions");
    expect(new Headers(init.headers).has("authorization")).toBe(false);
    expect(JSON.parse(init.body)).toMatchObject({
      model: "sonar-pro", max_tokens: 64, messages: [{ role: "user", content: "Synthetic QA input" }],
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("parses split streamed text and sources through a successful terminal event", async () => {
    proxyFetch.mockResolvedValue(streaming(
      event({ choices: [{ delta: { content: "QA_" } }], search_results: [{ title: "Authority", url: source }] }) +
      event({ choices: [{ delta: { content: "OK" }, finish_reason: "stop" }], citations: [source] }) +
      "data: [DONE]\n\n",
    ));
    expect(await collect()).toEqual([
      { text: "QA_" }, { citations: [{ title: "Authority", uri: source }] }, { text: "OK" },
    ]);
    expect(JSON.parse(proxyFetch.mock.calls[0][1].body).stream).toBe(true);
  });

  it("flags output-token truncation", async () => {
    proxyFetch.mockResolvedValue(streaming(event({
      choices: [{ delta: { content: "Partial" }, finish_reason: "length" }],
    }) + "data: [DONE]\n\n"));
    expect(await collect()).toEqual([{ text: "Partial" }, { truncated: true }]);
  });

  it("rejects an interrupted stream instead of marking it completed", async () => {
    proxyFetch.mockResolvedValue(streaming(event({ choices: [{ delta: { content: "Partial" } }] })));
    await expect(collect()).rejects.toThrow("without successful completion");
  });

  it.each(["length", "content_filter", null])("rejects incomplete non-stream output (%s)", async (reason) => {
    proxyFetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: reason, message: { content: "Partial" } }],
    }), { headers: { "Content-Type": "application/json" } }));
    await expect(generateChat(messages, options)).rejects.toThrow("empty or incomplete");
  });

  it("surfaces authentication failure without substituting another provider", async () => {
    proxyFetch.mockResolvedValue(new Response(JSON.stringify({
      error: { message: "Authentication rejected" },
    }), { status: 401, headers: { "Content-Type": "application/json" } }));
    await expect(generateChat(messages, options)).rejects.toThrow("Authentication rejected");
    expect(proxyFetch).toHaveBeenCalledOnce();
  });
});