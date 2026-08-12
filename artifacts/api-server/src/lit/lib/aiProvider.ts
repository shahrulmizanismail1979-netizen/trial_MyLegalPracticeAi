import OpenAI from "openai";
import { ai } from "@workspace/integrations-gemini-ai";
import { db } from "@workspace/db";
import { litAppSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Provider-agnostic AI text generation.
//
// Every generative call site in the api-server flows through this module so the
// provider can be switched per request. Gemini stays the default: when no
// provider is supplied (e.g. every request from the legal-platform artifact),
// generation runs on Gemini exactly as before, leaving that app unaffected.
//
// The IRAC artifact sends an explicit `provider` on each request (resolved on
// its client from: user override → admin default → gemini), which is honoured
// here. The stored admin default is intentionally NOT consulted server-side so
// that shared routes (enforcement, banking-recovery, etc.) used by both apps
// never change behaviour for the legal-platform unless a provider is explicitly
// sent.
// ─────────────────────────────────────────────────────────────────────────────

export type AIProvider = "gemini" | "openai" | "perplexity";

export const DEFAULT_PROVIDER: AIProvider = "gemini";

const GEMINI_MODEL = "gemini-2.5-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar-pro";

export function isAIProvider(v: unknown): v is AIProvider {
  return v === "gemini" || v === "openai" || v === "perplexity";
}

/** Coerce arbitrary input (request body/query) to a valid provider. */
export function normalizeProvider(v: unknown): AIProvider {
  return isAIProvider(v) ? v : DEFAULT_PROVIDER;
}

/** True when an OpenAI API key is configured (user-supplied secret). */
export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/** True when a Perplexity API key is configured (user-supplied secret). */
export function perplexityConfigured(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY);
}

// Perplexity exposes an OpenAI-compatible chat API at its own base URL.
let perplexityClient: OpenAI | null = null;
function getPerplexity(): OpenAI {
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error("PERPLEXITY_API_KEY is not set");
  }
  if (!perplexityClient) {
    perplexityClient = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: "https://api.perplexity.ai",
    });
  }
  return perplexityClient;
}

/** Perplexity attaches live-web sources to chunks; normalize them to Citations. */
interface PerplexitySearchResult {
  title?: string;
  url?: string;
}
function perplexityCitations(
  chunk: unknown,
  seen: Set<string>,
): Citation[] {
  const c = chunk as {
    search_results?: PerplexitySearchResult[];
    citations?: string[];
  };
  const fresh: Citation[] = [];
  for (const r of c.search_results ?? []) {
    if (r.url && !seen.has(r.url)) {
      seen.add(r.url);
      fresh.push({ uri: r.url, title: r.title || r.url });
    }
  }
  for (const uri of c.citations ?? []) {
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      fresh.push({ uri, title: uri });
    }
  }
  return fresh;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  text: string;
}

export interface Citation {
  title: string;
  uri: string;
}

export interface StreamPiece {
  text?: string;
  citations?: Citation[];
  /** Set when the model stopped because it hit the output-token limit. */
  truncated?: boolean;
}

export interface GenOptions {
  provider?: AIProvider;
  /** Enable Google Search grounding (Gemini only). Ignored by OpenAI. */
  grounded?: boolean;
  maxOutputTokens?: number;
  temperature?: number;
  /** System instruction applied in addition to any system-role litMessages. */
  systemInstruction?: string;
}

// ─── Gemini message mapping ──────────────────────────────────────────────────
function toGemini(litMessages: ChatMessage[], opts: GenOptions) {
  const systemParts: string[] = [];
  if (opts.systemInstruction) systemParts.push(opts.systemInstruction);

  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  for (const m of litMessages) {
    if (m.role === "system") {
      systemParts.push(m.text);
      continue;
    }
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    });
  }

  const config: Record<string, unknown> = {};
  if (opts.maxOutputTokens) config.maxOutputTokens = opts.maxOutputTokens;
  // Gemini 2.5 counts internal "thinking" tokens against maxOutputTokens.
  // Without a cap, long analyses burn most of the budget thinking and the
  // visible answer is truncated mid-sentence. Zero the thinking budget so the
  // entire limit goes to the actual output.
  config.thinkingConfig = { thinkingBudget: 0 };
  if (typeof opts.temperature === "number") config.temperature = opts.temperature;
  if (opts.grounded) config.tools = [{ googleSearch: {} }];
  if (systemParts.length > 0) config.systemInstruction = systemParts.join("\n");

  return { contents, config };
}

// ─── OpenAI message mapping ──────────────────────────────────────────────────
function toOpenAI(litMessages: ChatMessage[], opts: GenOptions) {
  const out: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  if (opts.systemInstruction) {
    out.push({ role: "system", content: opts.systemInstruction });
  }
  for (const m of litMessages) {
    out.push({ role: m.role, content: m.text });
  }
  return out;
}

/**
 * Stream a chat completion as an async generator of text/citation pieces.
 * Gemini yields grounding citations when `grounded` is set; OpenAI yields none
 * (it has no live Google Search grounding — callers surface a note instead).
 */
export async function* streamChat(
  litMessages: ChatMessage[],
  opts: GenOptions = {},
): AsyncGenerator<StreamPiece> {
  const provider = normalizeProvider(opts.provider);

  if (provider === "openai") {
    const client = getOpenAI();
    const stream = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: toOpenAI(litMessages, opts),
      max_tokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      stream: true,
    });
    let openaiFinish: string | undefined;
    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      const text = choice?.delta?.content;
      if (text) yield { text };
      if (choice?.finish_reason) openaiFinish = choice.finish_reason;
    }
    if (openaiFinish === "length") yield { truncated: true };
    return;
  }

  if (provider === "perplexity") {
    const client = getPerplexity();
    const stream = await client.chat.completions.create({
      model: PERPLEXITY_MODEL,
      messages: toOpenAI(litMessages, opts),
      max_tokens: opts.maxOutputTokens,
      temperature: opts.temperature,
      stream: true,
    });
    const seenUris = new Set<string>();
    let pplxFinish: string | undefined;
    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      const text = choice?.delta?.content;
      if (text) yield { text };
      if (choice?.finish_reason) pplxFinish = choice.finish_reason;
      const fresh = perplexityCitations(chunk, seenUris);
      if (fresh.length > 0) yield { citations: fresh };
    }
    if (pplxFinish === "length") yield { truncated: true };
    return;
  }

  // Gemini (default)
  const { contents, config } = toGemini(litMessages, opts);
  const stream = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config,
  });
  const seen = new Set<string>();
  let geminiFinish: string | undefined;
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield { text };
    const fr = chunk.candidates?.[0]?.finishReason as string | undefined;
    if (fr) geminiFinish = fr;
    const gm = chunk.candidates?.[0]?.groundingMetadata as
      | { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> }
      | undefined;
    if (gm?.groundingChunks) {
      const fresh: Citation[] = [];
      for (const c of gm.groundingChunks) {
        const uri = c.web?.uri;
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          fresh.push({ uri, title: c.web?.title || uri });
        }
      }
      if (fresh.length > 0) yield { citations: fresh };
    }
  }
  if (geminiFinish === "MAX_TOKENS") yield { truncated: true };
}

/** Non-streaming chat completion. Returns the full text and any citations. */
export async function generateChat(
  litMessages: ChatMessage[],
  opts: GenOptions = {},
): Promise<{ text: string; citations: Citation[] }> {
  const provider = normalizeProvider(opts.provider);

  if (provider === "openai") {
    const client = getOpenAI();
    const resp = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: toOpenAI(litMessages, opts),
      max_tokens: opts.maxOutputTokens,
      temperature: opts.temperature,
    });
    return { text: resp.choices?.[0]?.message?.content ?? "", citations: [] };
  }

  if (provider === "perplexity") {
    const client = getPerplexity();
    const resp = await client.chat.completions.create({
      model: PERPLEXITY_MODEL,
      messages: toOpenAI(litMessages, opts),
      max_tokens: opts.maxOutputTokens,
      temperature: opts.temperature,
    });
    const citations = perplexityCitations(resp, new Set<string>());
    return { text: resp.choices?.[0]?.message?.content ?? "", citations };
  }

  const { contents, config } = toGemini(litMessages, opts);
  const resp = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config,
  });
  return { text: resp.text ?? "", citations: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Drop-in compatibility layer for call sites that still build Gemini-style
// `{ model, contents, config }` payloads (the shared ai.ts / gemini.ts routes
// used by the legal-platform). They route through the provider abstraction so
// everything funnels through one chokepoint; with no `provider` supplied they
// default to Gemini, leaving the legal-platform unaffected.
// ─────────────────────────────────────────────────────────────────────────────
interface GeminiStylePart {
  text?: string;
}
interface GeminiStyleContent {
  role?: string;
  parts?: GeminiStylePart[];
}
interface GeminiStyleConfig {
  maxOutputTokens?: number;
  temperature?: number;
  tools?: unknown[];
  systemInstruction?: string;
}
interface GeminiStyleReq {
  model?: string;
  contents: GeminiStyleContent[];
  config?: GeminiStyleConfig;
  provider?: AIProvider;
}

function geminiContentsToMessages(contents: GeminiStyleContent[]): ChatMessage[] {
  return contents.map((c) => ({
    role:
      c.role === "model" || c.role === "assistant"
        ? "assistant"
        : c.role === "system"
          ? "system"
          : "user",
    text: (c.parts ?? []).map((p) => p.text ?? "").join(""),
  }));
}

function optsFromReq(req: GeminiStyleReq): GenOptions {
  return {
    provider: req.provider,
    grounded: Boolean(req.config?.tools?.length),
    maxOutputTokens: req.config?.maxOutputTokens,
    temperature: req.config?.temperature,
    systemInstruction: req.config?.systemInstruction,
  };
}

export function generateContentStreamCompat(
  req: GeminiStyleReq,
): AsyncGenerator<StreamPiece> {
  return streamChat(geminiContentsToMessages(req.contents), optsFromReq(req));
}

export async function generateContentCompat(
  req: GeminiStyleReq,
): Promise<{ text: string }> {
  const { text } = await generateChat(geminiContentsToMessages(req.contents), optsFromReq(req));
  return { text };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin default provider — persisted in the DB, surfaced to the IRAC client.
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDER_SETTING_KEY = "irac_ai_provider";

/** Read the admin-selected default provider (falls back to Gemini). */
export async function getDefaultProvider(): Promise<AIProvider> {
  try {
    const [row] = await db
      .select()
      .from(litAppSettings)
      .where(eq(litAppSettings.key, PROVIDER_SETTING_KEY));
    return normalizeProvider(row?.value);
  } catch (err) {
    logger.warn({ err }, "Failed to read default AI provider; using Gemini");
    return DEFAULT_PROVIDER;
  }
}

/** Persist the admin-selected default provider. */
export async function setDefaultProvider(provider: AIProvider): Promise<void> {
  await db
    .insert(litAppSettings)
    .values({ key: PROVIDER_SETTING_KEY, value: provider, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: litAppSettings.key,
      set: { value: provider, updatedAt: new Date() },
    });
}
