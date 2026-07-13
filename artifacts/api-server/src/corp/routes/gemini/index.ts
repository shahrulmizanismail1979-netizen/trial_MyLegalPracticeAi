import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, corpConversations as conversationsTable, corpMessages as messagesTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CorpCreateGeminiConversationBody,
  CorpSendGeminiMessageBody,
  CorpGetGeminiConversationResponse,
  CorpListGeminiMessagesResponseItem,
  CorpListGeminiConversationsResponseItem,
} from "@workspace/api-zod";
import { requireSession } from "../../lib/requireSession";

const router: IRouter = Router();

// All gemini routes require an authenticated subscriber session; conversations
// are scoped to the session's access code so subscribers cannot see each
// other's data.
router.use("/gemini", requireSession);

function accessCodeId(res: { locals: Record<string, unknown> }): number {
  return res.locals.accessCodeId as number;
}

router.get("/gemini/conversations", async (_req, res): Promise<void> => {
  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.accessCodeId, accessCodeId(res)))
    .orderBy(asc(conversationsTable.createdAt));
  res.json(conversations.map((c) => CorpListGeminiConversationsResponseItem.parse(c)));
});

router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const parsed = CorpCreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .insert(conversationsTable)
    .values({ title: parsed.data.title, accessCodeId: accessCodeId(res) })
    .returning();

  res.status(201).json(CorpListGeminiConversationsResponseItem.parse(conversation));
});

router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.accessCodeId, accessCodeId(res))));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  res.json(CorpGetGeminiConversationResponse.parse({ ...conversation, messages }));
});

router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [conversation] = await db
    .delete(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.accessCodeId, accessCodeId(res))))
    .returning();

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.accessCodeId, accessCodeId(res))));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  res.json(messages.map((m) => CorpListGeminiMessagesResponseItem.parse(m)));
});

router.post("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = CorpSendGeminiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.accessCodeId, accessCodeId(res))));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messagesTable).values({
    conversationId: id,
    role: "user",
    content: parsed.data.content,
  });

  const allMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullResponse = "";

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: allMessages.map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
      config: { maxOutputTokens: 8192 },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messagesTable).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Gemini stream error");
    res.write(`data: ${JSON.stringify({ error: "AI request failed", done: true })}\n\n`);
    res.end();
  }
});

export default router;
