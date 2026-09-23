import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, stream, finalMessage, abort, query, geminiCreate } = vi.hoisted(() => ({
  create: vi.fn(), stream: vi.fn(), finalMessage: vi.fn(), abort: vi.fn(),
  query: vi.fn(), geminiCreate: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create, stream };
  },
}));
vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: { models: { generateContent: geminiCreate } },
}));
vi.mock("@workspace/db", () => ({
  db: { select: () => ({ from: () => ({ where: query }) }) },
  litAppSettings: { key: "key" },
}));
vi.mock("../../lib/logger", () => ({ logger: { warn: vi.fn() } }));

import {
  anthropicConfigured, generateChat, getDefaultProvider, normalizeProvider, streamChat,
} from "./aiProvider";

const messages = [
  { role: "system" as const, text: "System message" },
  { role: "user" as const, text: "Synthetic input" },
];
const options = { provider: "anthropic" as const, systemInstruction: "Instructions", temperature: 0.3 };
async function collect() {
  const output = [];
  for await (const piece of streamChat(messages, options)) output.push(piece);
  return output;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AI_INTEGRATIONS_ANTHROPIC_API_KEY", "test-placeholder");
  vi.stubEnv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "https://proxy.invalid");
  stream.mockImplementation(() => ({
    async *[Symbol.asyncIterator]() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "QA_OK" } };
    },
    finalMessage, abort,
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe("Claude with OpenAI as the IRAC default", () => {
  it("uses OpenAI by default for IRAC while leaving unspecified legacy requests on Gemini", async () => {
    query.mockResolvedValue([]);
    expect(await getDefaultProvider()).toBe("openai");
    expect(normalizeProvider(undefined)).toBe("gemini");
    geminiCreate.mockResolvedValue({ text: "Existing Gemini output" });
    await expect(generateChat(messages)).resolves.toEqual({ text: "Existing Gemini output", citations: [] });
    expect(create).not.toHaveBeenCalled();
  });

  it("honours an explicit new admin preference and defaults safely after read failure", async () => {
    query.mockResolvedValueOnce([{ value: "anthropic" }]).mockRejectedValueOnce(new Error("DB unavailable"));
    expect(await getDefaultProvider()).toBe("anthropic");
    expect(await getDefaultProvider()).toBe("openai");
  });

  it("rejects obsolete Perplexity requests without sending them to a different provider", async () => {
    expect(() => normalizeProvider("perplexity")).toThrow("replaced by Claude");
    expect(create).not.toHaveBeenCalled();
  });

  it("maps system messages and preserves text without manufacturing citations", async () => {
    create.mockResolvedValue({
      content: [{ type: "text", text: "QA_OK" }], stop_reason: "end_turn",
    });
    await expect(generateChat(messages, options)).resolves.toEqual({ text: "QA_OK", citations: [] });
    expect(create).toHaveBeenCalledWith({
      model: "claude-sonnet-5", max_tokens: 8192,
      system: "Instructions\nSystem message",
      messages: [{ role: "user", content: "Synthetic input" }],
    });
  });

  it("requires complete configuration and reports missing setup explicitly", async () => {
    expect(anthropicConfigured()).toBe(true);
    vi.stubEnv("AI_INTEGRATIONS_ANTHROPIC_BASE_URL", "");
    expect(anthropicConfigured()).toBe(false);
    await expect(generateChat(messages, options)).rejects.toThrow("not configured");
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["max_tokens", "refusal", null])("rejects incomplete non-stream output (%s)", async (reason) => {
    create.mockResolvedValue({ content: [{ type: "text", text: "Partial" }], stop_reason: reason });
    await expect(generateChat(messages, options)).rejects.toThrow("empty or incomplete");
  });

  it("streams text and only completes after finalMessage succeeds", async () => {
    finalMessage.mockResolvedValue({ stop_reason: "end_turn" });
    expect(await collect()).toEqual([{ text: "QA_OK" }]);
    expect(finalMessage).toHaveBeenCalledOnce();
    expect(abort).toHaveBeenCalledOnce();
  });

  it("propagates interrupted-stream failures and releases the stream", async () => {
    finalMessage.mockRejectedValue(new Error("Connection interrupted"));
    await expect(collect()).rejects.toThrow("Connection interrupted");
    expect(abort).toHaveBeenCalledOnce();
  });

  it("marks max-token termination truncated", async () => {
    finalMessage.mockResolvedValue({ stop_reason: "max_tokens" });
    expect(await collect()).toEqual([{ text: "QA_OK" }, { truncated: true }]);
  });

  it("rejects unexpected stop reasons and provider failures without fallback", async () => {
    finalMessage.mockResolvedValue({ stop_reason: "refusal" });
    await expect(collect()).rejects.toThrow("without successful completion");
    create.mockRejectedValue(new Error("Provider unavailable"));
    await expect(generateChat(messages, options)).rejects.toThrow("Provider unavailable");
    expect(geminiCreate).not.toHaveBeenCalled();
  });
});