import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, GenOptions, StreamPiece } from "./aiProvider";

const MODEL = "claude-sonnet-5";
let client: Anthropic | undefined;

export function anthropicConfigured(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY &&
    process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  );
}

function getClient(): Anthropic {
  if (!anthropicConfigured()) throw new Error("Anthropic Claude is not configured");
  return client ??= new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

function request(messages: ChatMessage[], opts: GenOptions) {
  const system = [
    opts.systemInstruction,
    ...messages.filter((message) => message.role === "system").map((message) => message.text),
  ].filter(Boolean).join("\n");
  return {
    model: MODEL,
    max_tokens: opts.maxOutputTokens ?? 8192,
    ...(system ? { system } : {}),
    messages: messages.filter((message) => message.role !== "system").map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.text,
    })),
    // Sonnet 5 does not accept non-default temperature. No web-search tool is
    // enabled: these answers must never masquerade as source-grounded research.
  };
}

export async function generateAnthropic(messages: ChatMessage[], opts: GenOptions) {
  const response = await getClient().messages.create(request(messages, opts));
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text).join("");
  if (response.stop_reason !== "end_turn" || !text.trim()) {
    throw new Error("Claude response was empty or incomplete");
  }
  return { text, citations: [] };
}

export async function* streamAnthropic(
  messages: ChatMessage[], opts: GenOptions,
): AsyncGenerator<StreamPiece> {
  const stream = getClient().messages.stream(request(messages, opts));
  let hasText = false;
  try {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        hasText ||= Boolean(event.delta.text.trim());
        yield { text: event.delta.text };
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "max_tokens") {
      yield { truncated: true };
    } else if (final.stop_reason !== "end_turn" || !hasText) {
      throw new Error("Claude response ended without successful completion");
    }
  } finally {
    stream.abort();
  }
}