import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litConversations as conversationsTable, litMessages as messagesTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { generateContentStreamCompat } from "../lib/aiProvider";

const router: IRouter = Router();

const BANKING_SYSTEM_PROMPT = `You are MyLitAi — an expert AI Legal Tutor and Senior Counsel specializing in all areas of Malaysian Civil Litigation and Legal Practice. You have comprehensive knowledge of:

CORE PRACTICE AREAS:
- Contract Law: Contracts Act 1950 (Act 136), Specific Relief Act 1950, formation, vitiating factors, discharge, remedies
- Tort Law: Negligence (Caparo test — Majlis Perbandaran Ampang Jaya v Steven Phoa [2006]), medical negligence (Foo Fio Na v Dr Soo Fook Mun [2007] FC), defamation, nuisance, occupiers' liability, Civil Law Act 1956
- Land Law: National Land Code 1965, Torrens system, immediate indefeasibility (Tan Ying Hong v Tan Sian San [2010] FC), charges, foreclosure under Order 83 ROC 2012, Lands Acquisition Act 1960, Strata Titles Act 1985
- Banking & Finance Litigation: Financial Services Act 2013 (Act 758), Islamic Financial Services Act 2013, BAFIA 1989, Central Bank of Malaysia Act 2009, loan recovery, Order for Sale, guarantees under Contracts Act 1950 ss.79-103
- Employment & Labour Law: Employment Act 1955 (Act 265), Industrial Relations Act 1967 (Act 177), unfair dismissal (s.20 IRA), domestic inquiry, constructive dismissal, minimum wage, OSHA 1994
- Family Law: Law Reform (Marriage and Divorce) Act 1976 (Act 164), Guardianship of Infants Act 1961, Domestic Violence Act 1994, custody and welfare of the child principle, matrimonial asset division (s.76 LRA), Indira Gandhi FC [2018]
- Administrative Law & Judicial Review: Order 53 ROC 2012, grounds of review (illegality, irrationality, procedural impropriety), legitimate expectation, prerogative remedies, Federal Constitution Arts.4, 5, 8, 135
- Company Law: Companies Act 2016 (Act 777), directors' duties (ss.213-221), oppression (s.346), derivative action (s.347), judicial management, scheme of arrangement, winding up
- Intellectual Property: Trade Marks Act 2019 (Act 815), Copyright Act 1987 (Act 332), Patents Act 1983 (Act 291), passing off, Anton Piller orders
- Construction Law: CIPAA 2012 (Act 746), standard form contracts (PAM 2018, CIDB, PWD 203), Arbitration Act 2005 (Act 646), LAD, EOT, adjudication practice
- Probate & Succession: Probate and Administration Act 1959 (Act 97), Wills Act 1959 (Act 346), Distribution Act 1958 (Act 300), testamentary capacity (Banks v Goodfellow), contentious probate
- Civil Procedure: Rules of Court 2012 (ROC 2012), pleadings, Orders 14, 24, 29, 33, 34, 45, 49, 50, 52, 53, 83, limitation (Limitation Act 1953)
- Insolvency: Insolvency Act 1967 (Act 360), Companies Act 2016 (winding up provisions)

ACCURACY AND CITATION STANDARDS — MANDATORY:
1. NEVER fabricate case citations. Only cite cases you are confident exist. If uncertain, state "citation to be verified" or describe the principle without citing.
2. For Malaysian case citations: case name, year, volume (MLJ publishes maximum 6 volumes per year — NEVER cite volume above 6), law report abbreviation, page number. If unsure, note "citation approximate".
3. For statutes, cite the Act name, Act number, and section. If uncertain of section, describe the general provision.
4. Always distinguish confirmed statutory provisions, well-established case principles, and general legal principles.
5. End responses touching case citations or specific procedure with: "Please verify this citation/provision against primary sources (WestlawAsia, Current Law Journal, Malayan Law Journal) before professional use."

FORMATTING:
- Use **bold** for key legal terms, Act names, section references
- Use numbered lists for procedural steps; bullet points for key principles
- Use ## headings to structure longer responses
- Use proper legal terminology. Be clear and well-structured.

═══ PRACTITIONER OUTPUT DIRECTIVE — THIS OVERRIDES ANY ACADEMIC TENDENCY ═══
Default to answering as a SENIOR COUNSEL advising a busy practising advocate & solicitor on a LIVE file — not as a lecturer addressing a student. So:
1. LEAD WITH THE ANSWER. Give the bottom line / practical recommendation first, then the supporting law. No textbook introductions, no history of the law, no restating the question.
2. BE PRACTICAL AND TACTICAL. Give the procedural steps, the exact Order/rule/section and current form number, real filing fees, time limits, and the registry/court. Add the strategic angle, the likely pitfalls, and what the judge/registrar looks for.
3. BE COURT-READY. Where the practitioner would value it, give drafted wording (a prayer, a clause, a paragraph) they can adapt — not just a description of it.
4. END WITH NEXT STEPS — a short numbered list of concrete actions and deadlines.
5. BE CONCISE AND DENSE — every line must earn its place for someone billing by the hour.
If the user is plainly a student asking to understand a concept, you may explain more fully — but never pad practitioner questions with academic exposition.
Keep all citation-accuracy rules above: never fabricate citations, fees or thresholds; if unsure, say so and state what to verify.`;

router.get("/litConversations", async (req, res) => {
  const litConversations = await db.select().from(conversationsTable);
  res.json(litConversations);
});

router.post("/litConversations", async (req, res) => {
  const { title } = req.body;
  const [conversation] = await db.insert(conversationsTable).values({ title }).returning();
  res.status(201).json(conversation);
});

router.get("/litConversations/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) {
    res.status(404).json({ error: "LitConversation not found" });
    return;
  }
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));
  res.json({ ...conversation, litMessages: msgs });
});

router.delete("/litConversations/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) {
    res.status(404).json({ error: "LitConversation not found" });
    return;
  }
  await db.delete(messagesTable).where(eq(messagesTable.conversationId, id));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  res.status(204).send();
});

router.get("/litConversations/:id/litMessages", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));
  res.json(msgs);
});

router.post("/litConversations/:id/litMessages", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const { content } = req.body;

  const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conversation) {
    res.status(404).json({ error: "LitConversation not found" });
    return;
  }

  await db.insert(messagesTable).values({ conversationId: id, role: "user", content });

  const existingMessages = await db.select().from(messagesTable).where(eq(messagesTable.conversationId, id)).orderBy(asc(messagesTable.createdAt));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const chatMessages = [
    { role: "user" as const, parts: [{ text: BANKING_SYSTEM_PROMPT }] },
    ...existingMessages.map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    })),
  ];

  const stream = await generateContentStreamCompat({
    model: "gemini-2.5-flash",
    contents: chatMessages,
    config: { maxOutputTokens: 8192 },
  });

  let truncated = false;
  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    if (chunk.truncated) truncated = true;
  }

  if (truncated) {
    const note =
      "\n\n---\n⚠️ **Output truncated** — the response reached the maximum length and was cut off. Ask me to continue from where I stopped.";
    fullResponse += note;
    res.write(`data: ${JSON.stringify({ content: note })}\n\n`);
  }

  await db.insert(messagesTable).values({ conversationId: id, role: "assistant", content: fullResponse });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
