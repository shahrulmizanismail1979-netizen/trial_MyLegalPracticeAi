import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db, ccbConversations, ccbMessages } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { aiRateLimit } from "../../lib/aiRateLimit";

const router: IRouter = Router();

const SYSTEM_INSTRUCTION = `You are MyCCBLitAI Legal Assistant, an expert AI assistant specializing in Malaysian corporate, commercial, and banking litigation. You are built by Mohd Saufi Samsudin, Mohd Irwan Mohd Mubarak, Shahrul Mizan Ismail and Mahmud Hamdi Mahmud Saedon of the Faculty of Law, Universiti Kebangsaan Malaysia.

Your expertise covers:
- Corporate litigation (shareholder disputes, directors' duties, oppression actions, winding up)
- Commercial litigation (contract disputes, fraud, tortious interference, injunctions)
- Banking litigation (debt recovery, foreclosure, guarantee enforcement, receivership)
- Malaysian legal framework (Companies Act 2016, Contracts Act 1950, National Land Code 1965, Capital Markets and Services Act 2007, Arbitration Act 2005)
- Malaysian court procedures (Rules of Court 2012, practice directions)
- Case law analysis and legal research

Always cite relevant Malaysian statutes and case law where appropriate. Use formal legal language but remain clear and accessible. When discussing case law, use proper Malaysian citation format (e.g., [2020] 1 CLJ 123). Always note that legal advice should be verified and that case citations should be checked against primary sources.`;

const CreateConversationBody = z.object({ title: z.string().min(1) });
const ConversationIdParam = z.object({ id: z.coerce.number().int().positive() });
const SendMessageBody = z.object({ content: z.string().min(1) });

/**
 * Access code ID bound to the current session by requirePractitioner.
 * null → admin/static-code session (unrestricted view).
 * number → subscriber session (sees only their own conversations).
 */
function callerAccessCodeId(res: import("express").Response): number | null {
  return (res.locals["ccbAccessCodeId"] as number | null) ?? null;
}

router.get("/gemini/conversations", async (_req, res): Promise<void> => {
  const accessId = callerAccessCodeId(res);
  const filter =
    accessId !== null ? eq(ccbConversations.accessCodeId, accessId) : undefined;
  const conversations = await db
    .select()
    .from(ccbConversations)
    .where(filter)
    .orderBy(desc(ccbConversations.createdAt));
  res.json(conversations);
});

router.post("/gemini/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const accessId = callerAccessCodeId(res);
  const [conversation] = await db
    .insert(ccbConversations)
    .values({ title: parsed.data.title, accessCodeId: accessId })
    .returning();
  res.status(201).json(conversation);
});

router.get("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = ConversationIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const accessId = callerAccessCodeId(res);
  const filter =
    accessId !== null
      ? and(
          eq(ccbConversations.id, params.data.id),
          eq(ccbConversations.accessCodeId, accessId),
        )
      : eq(ccbConversations.id, params.data.id);
  const [conversation] = await db.select().from(ccbConversations).where(filter);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db
    .select()
    .from(ccbMessages)
    .where(eq(ccbMessages.conversationId, params.data.id))
    .orderBy(ccbMessages.createdAt);
  res.json({ ...conversation, messages });
});

router.delete("/gemini/conversations/:id", async (req, res): Promise<void> => {
  const params = ConversationIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const accessId = callerAccessCodeId(res);
  const filter =
    accessId !== null
      ? and(
          eq(ccbConversations.id, params.data.id),
          eq(ccbConversations.accessCodeId, accessId),
        )
      : eq(ccbConversations.id, params.data.id);
  await db.delete(ccbMessages).where(eq(ccbMessages.conversationId, params.data.id));
  const [deleted] = await db
    .delete(ccbConversations)
    .where(filter)
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.json({ success: true });
});

router.get("/gemini/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ConversationIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Ownership check: verify the conversation belongs to this caller before
  // returning its messages.
  const accessId = callerAccessCodeId(res);
  const convFilter =
    accessId !== null
      ? and(
          eq(ccbConversations.id, params.data.id),
          eq(ccbConversations.accessCodeId, accessId),
        )
      : eq(ccbConversations.id, params.data.id);
  const [conversation] = await db.select().from(ccbConversations).where(convFilter);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const messages = await db
    .select()
    .from(ccbMessages)
    .where(eq(ccbMessages.conversationId, params.data.id))
    .orderBy(ccbMessages.createdAt);
  res.json(messages);
});

router.post("/gemini/conversations/:id/messages", aiRateLimit, async (req, res): Promise<void> => {
  const params = ConversationIdParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const bodyParsed = SendMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  // Ownership check before mutating.
  const accessId = callerAccessCodeId(res);
  const convFilter =
    accessId !== null
      ? and(
          eq(ccbConversations.id, params.data.id),
          eq(ccbConversations.accessCodeId, accessId),
        )
      : eq(ccbConversations.id, params.data.id);
  const [conversation] = await db.select().from(ccbConversations).where(convFilter);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(ccbMessages).values({
    conversationId: params.data.id,
    role: "user",
    content: bodyParsed.data.content,
  });

  const existingMessages = await db
    .select()
    .from(ccbMessages)
    .where(eq(ccbMessages.conversationId, params.data.id))
    .orderBy(ccbMessages.createdAt);

  const chatMessages = existingMessages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    let fullResponse = "";
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: chatMessages,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 8192,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(ccbMessages).values({
      conversationId: params.data.id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    req.log.error({ error }, "CCB Gemini chat failed");
    res.write(`data: ${JSON.stringify({ error: "Chat response failed. Please try again." })}\n\n`);
    res.end();
  }
});

export default router;
