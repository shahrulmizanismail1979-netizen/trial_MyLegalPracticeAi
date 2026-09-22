import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { completionCreate, openAIConstructor } = vi.hoisted(() => ({
  completionCreate: vi.fn(),
  openAIConstructor: vi.fn(),
}));

vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: { models: {} },
}));

vi.mock("@workspace/db", () => ({
  db: {},
  litAppSettings: {},
}));

vi.mock("../../lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { create: completionCreate } };

    constructor(options: unknown) {
      openAIConstructor(options);
    }
  },
}));

import { generateChat, openaiConfigured } from "./aiProvider";

describe("IRAC OpenAI provider selection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    completionCreate.mockReset();
    openAIConstructor.mockClear();
    delete process.env.OPENAI_API_KEY;
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "proxy-compatible-placeholder";
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = "https://proxy.invalid/v1";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses the configured Replit proxy when no direct OpenAI key exists", async () => {
    completionCreate.mockResolvedValue({
      choices: [{ message: { content: "QA_OK" } }],
    });

    expect(openaiConfigured()).toBe(true);
    await expect(
      generateChat([{ role: "user", text: "Return exactly QA_OK" }], {
        provider: "openai",
        maxOutputTokens: 16,
      }),
    ).resolves.toEqual({ text: "QA_OK", citations: [] });

    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: "proxy-compatible-placeholder",
      baseURL: "https://proxy.invalid/v1",
    });
    expect(completionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        max_tokens: 16,
      }),
    );
  });

  it("preserves an explicitly configured direct OpenAI key", async () => {
    process.env.OPENAI_API_KEY = "direct-key-placeholder";
    completionCreate.mockResolvedValue({
      choices: [{ message: { content: "DIRECT_OK" } }],
    });

    await expect(
      generateChat([{ role: "user", text: "Return exactly DIRECT_OK" }], {
        provider: "openai",
      }),
    ).resolves.toEqual({ text: "DIRECT_OK", citations: [] });

    expect(openAIConstructor).toHaveBeenCalledWith({
      apiKey: "direct-key-placeholder",
    });
    expect(completionCreate).toHaveBeenCalledOnce();
  });
});