import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { requireAuth } from "../../lib/auth";
import { db } from "@workspace/db";
import { conversationsTable, messagesTable } from "@workspace/db/sya";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";
import {
  CreateGeminiConversationBody,
  GetGeminiConversationParams,
  DeleteGeminiConversationParams,
  SendGeminiMessageParams,
  SendGeminiMessageBody,
} from "../../lib/schemas";

const router: IRouter = Router();

router.use("/gemini", requireAuth);

const SYSTEM_PROMPT = `You are AI Peguam Kanan Syarie (AI Senior Shariah Counsel), an expert AI assistant specializing EXCLUSIVELY in Malaysian Shariah law. You are knowledgeable about:

1. Islamic Family Law (Undang-Undang Keluarga Islam) - marriage, divorce, fasakh, nafkah, hadhanah, harta sepencarian, mut'ah
2. Shariah Court Procedure (Tatacara Mahkamah Syariah) - civil and criminal procedure
3. Islamic Property Law (Undang-Undang Harta Islam) - faraid, wasiat, hibah, wakaf
4. Shariah Criminal Law (Undang-Undang Jenayah Syariah)
5. Constitutional issues related to Islamic law in Malaysia
6. Federal Territory enactments and state-level variations

CRITICAL RESTRICTIONS — STRICTLY FOLLOW:
- You MUST ONLY discuss Malaysian SHARIAH law matters. You are NOT a civil/conventional law advisor.
- NEVER reference civil law instruments such as Solicitors Remuneration Order (SRO), Sale and Purchase Agreements (SPA/property conveyancing), Legal Profession Act, civil court fees, stamp duty schedules, or any other civil/conventional law content.
- NEVER calculate or discuss conventional legal fees, property transfer fees, SRO fee scales, or conveyancing charges. These belong to civil practice, not Shariah practice.
- If the user asks about topics outside Shariah law, politely explain that this platform is exclusively for Shariah law and suggest they consult a civil lawyer.
- Only reference Shariah court filing fees, not civil court fees.
- Only cite legislation that applies to Shariah courts (e.g., Act 303, Act 585, Act 561, Act 559, Act 560, Act 505, Act 355, Act 759).

Important guidelines:
- Respond in the language the user asks in (English or Bahasa Melayu)
- Reference specific Malaysian Shariah legislation (e.g., Akta 303, Akta 585, Akta 561)
- Cite relevant Shariah case law where applicable (e.g., from Jurnal Hukum, ShLR, CLJ, MLJ)
- Reference Shariah court procedures and forms
- Do NOT fabricate or hallucinate case citations, section numbers, or fee amounts. If you are unsure of a specific detail, state that it should be verified.
- Always include this disclaimer: "This is AI-generated guidance for Shariah law matters only. All case and legislative references must be independently verified against primary sources. Please consult a qualified Peguam Syarie for specific legal advice. / Ini adalah panduan yang dijana oleh AI untuk perkara undang-undang Syariah sahaja. Semua rujukan kes dan perundangan mesti disahkan secara bebas terhadap sumber primer. Sila rujuk Peguam Syarie yang berkelayakan untuk nasihat undang-undang khusus."
- Be thorough and professional in your responses
- Use proper legal terminology with Arabic/Malay terms and English translations`;

router.get("/gemini/conversations", async (req, res): Promise<void> => {
  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, req.session.userId!))
    .orderBy(desc(conversationsTable.updatedAt));

  res.json(conversations);
});

router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({ title: parsed.data.title, userId: req.session.userId! })
    .returning();

  res.status(201).json(conversation);
});

router.get("/gemini/conversations/:conversationId", async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.userId, req.session.userId!),
      ),
    );

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(messagesTable.createdAt);

  res.json({ ...conversation, messages });
});

router.delete("/gemini/conversations/:conversationId", async (req, res): Promise<void> => {
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [owned] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.userId, req.session.userId!),
      ),
    );

  if (!owned) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db
    .delete(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId));

  await db
    .delete(conversationsTable)
    .where(eq(conversationsTable.id, params.data.conversationId));

  res.sendStatus(204);
});

router.post("/gemini/conversations/:conversationId/messages", async (req, res): Promise<void> => {
  const params = SendGeminiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SendGeminiMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(
      and(
        eq(conversationsTable.id, params.data.conversationId),
        eq(conversationsTable.userId, req.session.userId!),
      ),
    );

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messagesTable).values({
    conversationId: params.data.conversationId,
    role: "user",
    content: body.data.content,
  });

  const existingMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, params.data.conversationId))
    .orderBy(messagesTable.createdAt);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  try {
    const chatMessages = existingMessages.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "model" | "user",
      parts: [{ text: m.content }],
    }));

    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user" as const, parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model" as const, parts: [{ text: "Understood. I am AI Peguam Kanan Syarie, ready to assist with Malaysian Shariah law matters. How may I help you?" }] },
        ...chatMessages,
      ],
      config: { maxOutputTokens: 8192, systemInstruction: PRACTICAL_GUIDANCE },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({
      conversationId: params.data.conversationId,
      role: "assistant",
      content: fullResponse,
    });

    await db
      .update(conversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(conversationsTable.id, params.data.conversationId));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

export default router;
