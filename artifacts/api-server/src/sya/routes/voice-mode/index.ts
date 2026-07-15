import { Router, type IRouter } from "express";
import { ai } from "@workspace/integrations-gemini-ai";
import { PRACTICAL_GUIDANCE } from "../../lib/prompt-guidance.js";

const router: IRouter = Router();

type VoiceMode = "submission" | "examination_in_chief" | "cross_examination" | "judge_questioning";

const MODE_META: Record<VoiceMode, { titleEn: string; titleBm: string; aiRole: string; descEn: string; descBm: string }> = {
  submission: {
    titleEn: "Oral Submission Practice",
    titleBm: "Latihan Hujah Lisan",
    aiRole: "Yang Arif (Shariah High Court Judge)",
    descEn: "Deliver your oral submission. The AI plays a sceptical Yang Arif who interjects with probing questions on jurisdiction, evidence, and legal authority.",
    descBm: "Sampaikan hujah lisan anda. AI berperanan sebagai Yang Arif yang skeptikal dan akan mencelah dengan soalan tajam mengenai bidang kuasa, keterangan, dan otoriti undang-undang.",
  },
  examination_in_chief: {
    titleEn: "Examination-in-Chief Practice",
    titleBm: "Latihan Pemeriksaan Utama",
    aiRole: "Witness (Saksi)",
    descEn: "Examine your own witness. The AI plays a cooperative but cautious witness — your task is to elicit the relevant facts without leading questions.",
    descBm: "Periksa saksi anda sendiri. AI berperanan sebagai saksi yang bekerjasama tetapi berhati-hati — tugas anda adalah memperolehi fakta-fakta relevan tanpa soalan mengarah.",
  },
  cross_examination: {
    titleEn: "Cross-Examination Practice",
    titleBm: "Latihan Pemeriksaan Balas",
    aiRole: "Hostile Witness (Saksi Bermusuh)",
    descEn: "Cross-examine an opposing witness. The AI plays a hostile witness who is evasive, defensive, and loyal to the other party. Your task is to expose contradictions.",
    descBm: "Periksa balas saksi pihak lawan. AI berperanan sebagai saksi bermusuh yang mengelak, mempertahankan diri, dan setia kepada pihak lawan. Tugas anda adalah mendedahkan percanggahan.",
  },
  judge_questioning: {
    titleEn: "Bench Q&A Practice",
    titleBm: "Latihan Soal Jawab Mahkamah",
    aiRole: "Yang Arif (Shariah Court of Appeal Bench)",
    descEn: "Stand before a panel of three Yang Arif at the Shariah Court of Appeal. They will fire rapid questions on your written submission and demand crisp answers.",
    descBm: "Berdiri di hadapan panel tiga Yang Arif di Mahkamah Rayuan Syariah. Mereka akan menyoal pantas mengenai hujah bertulis anda dan menuntut jawapan yang tepat.",
  },
};

router.get("/voice-mode/modes", (_req, res): void => {
  res.json(Object.entries(MODE_META).map(([id, m]) => ({ id, ...m })));
});

interface Turn {
  role: "user" | "ai";
  text: string;
}

router.post("/voice-mode/respond", async (req, res): Promise<void> => {
  const { mode, scenario, transcript, language } = req.body as {
    mode?: VoiceMode;
    scenario?: string;
    transcript?: Turn[];
    language?: string;
  };

  const meta = mode && MODE_META[mode];
  if (!meta) {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }
  if (!Array.isArray(transcript) || transcript.length === 0) {
    res.status(400).json({ error: "Transcript is required" });
    return;
  }

  const lang: "en" | "bm" = language === "bm" ? "bm" : "en";
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const langInstr = lang === "bm"
    ? "JAWAB DALAM BAHASA MELAYU MAHKAMAH SYARIAH yang formal. Gunakan istilah seperti 'Yang Arif', 'pihak Plaintif', 'pihak Defendan', 'kebenaran mahkamah', 'bantahan'."
    : "REPLY in formal Malaysian Shariah court English. Use terms like 'Yang Arif', 'the Plaintiff', 'the Defendant', 'with the leave of the court', 'objection'.";

  let rolePrompt = "";
  if (mode === "submission") {
    rolePrompt = `You are Yang Arif, a senior Shariah High Court judge in Malaysia. You are listening to oral submission by a Peguam Syarie (Shariah counsel). Your job is to interject with sharp, sceptical questions every 1-3 turns. Probe:
- jurisdictional foundations (which state enactment?)
- evidentiary basis (where is the keterangan?)
- authority (cite the case)
- procedural compliance (Tatacara Mal/Jenayah)

Stay in character as Yang Arif. Do NOT explain that you are an AI. Speak in the first person ("Saya kurang faham...", "Mengapa peguam ini berhujah..."). Keep each judicial interjection to 1-3 sentences — this is oral exchange, not written prose.`;
  } else if (mode === "examination_in_chief") {
    rolePrompt = `You are a witness (Saksi) in a Shariah court matter being examined-in-chief by the counsel calling you. You ARE cooperative but you only answer what is asked. You do NOT volunteer information. You answer in plain everyday speech, not legal jargon. If counsel asks a leading question, answer truthfully but the opposing counsel may later object — you do not object yourself.

Background scenario for your character:\n${scenario || "(no scenario provided — invent a plausible Malaysian Shariah family/property/criminal matter consistent with the conversation so far)"}

Stay strictly in character. Each answer should be 1-3 sentences. Do NOT break character to explain anything.`;
  } else if (mode === "cross_examination") {
    rolePrompt = `You are a hostile witness (saksi pihak lawan) being cross-examined. You are loyal to the OTHER party. You are evasive, you sometimes claim not to remember, you give qualified answers, and you try to slip in self-serving comments. You do NOT lie outright when contradicted with documents — but you minimise, deflect, and resist conceding points.

Background scenario for your character:\n${scenario || "(no scenario — infer from the conversation so far)"}

Stay strictly in character. Keep each answer short (1-3 sentences) — long answers are how counsel traps you, so you stay short. Do NOT break character.`;
  } else {
    rolePrompt = `You are a panel of three Yang Arif at the Shariah Court of Appeal of Malaysia. The appellant's counsel is making oral submission. You take turns asking sharp, rapid questions — sometimes one of you asks a follow-up before counsel finishes answering the previous one. Indicate which Yang Arif is speaking by prefixing with "[YA1]", "[YA2]", or "[YA3]". Probe inconsistencies between the written and oral submission, demand specific paragraph references, and test the limits of the legal proposition. Each judicial intervention is 1-3 sentences.`;
  }

  const SYSTEM = `${rolePrompt}

${langInstr}

CRITICAL:
- You are in a LIVE oral exchange. Be brief. 1-3 sentences per turn maximum.
- Never narrate stage directions ("the judge frowns") — only spoken words.
- Never refer to yourself as an AI, model, or assistant.
- Do NOT fabricate Malaysian case citations. If you must reference authority, refer generally ("the Court of Appeal in a recent custody case held...") rather than inventing specific citations.`;

  const history = transcript.map(t => {
    const speaker = t.role === "user"
      ? (mode === "submission" || mode === "judge_questioning" ? "Counsel" : "Counsel (examining)")
      : meta.aiRole;
    return `${speaker}: ${t.text}`;
  }).join("\n\n");

  const FULL_PROMPT = `${SYSTEM}\n\nCONVERSATION SO FAR:\n${history}\n\nNow respond as ${meta.aiRole}. Output ONLY the spoken words, nothing else.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: FULL_PROMPT,
      config: { systemInstruction: PRACTICAL_GUIDANCE },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Voice response failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

router.post("/voice-mode/feedback", async (req, res): Promise<void> => {
  const { mode, transcript, language } = req.body as {
    mode?: VoiceMode;
    transcript?: Turn[];
    language?: string;
  };
  const meta = mode && MODE_META[mode];
  if (!meta) { res.status(400).json({ error: "Invalid mode" }); return; }
  if (!Array.isArray(transcript) || transcript.length < 2) {
    res.status(400).json({ error: "Need at least one full exchange before feedback" });
    return;
  }
  const lang: "en" | "bm" = language === "bm" ? "bm" : "en";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const langInstr = lang === "bm"
    ? "Tulis maklum balas dalam Bahasa Melayu profesional."
    : "Write the feedback in professional English.";

  const transcriptStr = transcript.map(t => `${t.role === "user" ? "COUNSEL" : meta.aiRole.toUpperCase()}: ${t.text}`).join("\n\n");

  const FEEDBACK_PROMPT = `You are a senior Peguam Syarie trainer reviewing a junior counsel's practice session in "${meta.titleEn}". Provide constructive feedback.

${langInstr}

Use these section headings (translate to the output language):
1. **Strengths** — what counsel did well (specific quotes from the transcript).
2. **Weaknesses** — concrete weaknesses with quoted examples.
3. **Procedural Issues** — leading questions in EIC, failure to lay foundation, improper questions in cross, jurisdictional gaps in submission, etc.
4. **Suggested Reformulations** — for 2-3 of the weakest exchanges, give a better way counsel could have phrased the question or argument.
5. **Overall Score** — out of 10, with one-sentence justification.

TRANSCRIPT:
${transcriptStr}

Begin the feedback now.`;

  try {
    const stream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: FEEDBACK_PROMPT,
      config: { systemInstruction: PRACTICAL_GUIDANCE },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Feedback generation failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    res.end();
  }
});

export default router;
