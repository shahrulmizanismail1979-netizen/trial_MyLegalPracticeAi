import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { requireSubscription } from "./billing";
import { streamChat, normalizeProvider } from "../lib/aiProvider";

const router: IRouter = Router();

// Oral Advocacy is a premium feature — gate every route here.
router.use(requireSubscription);

const connectors = new ReplitConnectors();

type Scenario =
  | "oral_submission"
  | "examination_in_chief"
  | "cross_examination"
  | "negotiation";

type PersonaRole = "judge" | "witness" | "opposing_counsel";

// ElevenLabs premade voice IDs (available to every account). These are sensible
// defaults per persona; if any are unavailable the API still returns audio for a
// valid voice id, otherwise /tts surfaces the error.
const VOICE_BY_ROLE: Record<PersonaRole, string> = {
  judge: "pNInz6obpgDQGcFmaJgB", // Adam — deep, authoritative
  witness: "21m00Tcm4TlvDq8ikWAM", // Rachel — neutral, measured
  opposing_counsel: "ErXwobaYiN019PkySvjV", // Antoni — assertive
};

const ROLE_BY_SCENARIO: Record<Scenario, PersonaRole> = {
  oral_submission: "judge",
  examination_in_chief: "witness",
  cross_examination: "witness",
  negotiation: "opposing_counsel",
};

const BASE_RULES = `You are role-playing in a LIVE oral-practice drill for a Malaysian advocate & solicitor. Critical rules:
- Stay 100% in character. Never break role, never narrate stage directions, never add disclaimers.
- This is SPOKEN dialogue: reply in plain prose only — NO markdown, NO headings, NO bullet points, NO asterisks.
- Keep each turn realistic and concise: usually 1–5 sentences. Speak naturally, as a person would in court.
- Use correct Malaysian courtroom register and forms of address ("My Lord"/"My Lady"/"Yang Arif" for judges; "Counsel" for advocates).
- React to what the user just said. Be demanding and realistic so the drill has training value — do not be a pushover.
- Do not give the user feedback or coaching while in character; just play the role convincingly.`;

function buildPersona(
  scenario: Scenario,
  caseContext: string,
  userRole: string,
  witness: string,
): string {
  const context = `\n\nMATTER / FACTS PROVIDED BY THE PRACTITIONER:\n${caseContext || "(none provided — improvise a plausible Malaysian civil matter)"}`;
  const yourRole = userRole?.trim()
    ? `\nThe user (the human you are speaking with) is: ${userRole.trim()}.`
    : "";

  switch (scenario) {
    case "oral_submission":
      return `${BASE_RULES}

YOUR CHARACTER: You are the presiding Judge of a Malaysian High Court hearing oral submissions. The user is counsel making oral submissions before you.${yourRole}
Behave as a sharp bench: listen, then interject with probing questions, test counsel's authorities and propositions, ask them to take you to the relevant Order/section, challenge weak points, and keep them to the issues. Occasionally indicate when a point is well taken.${context}`;
    case "examination_in_chief":
      return `${BASE_RULES}

YOUR CHARACTER: You are a WITNESS giving evidence in a Malaysian civil trial, being examined in chief by the user (counsel calling you).${yourRole}
${witness?.trim() ? `Witness profile: ${witness.trim()}.` : "Adopt a plausible witness profile consistent with the matter."}
Answer only what is asked, truthfully and in your own words consistent with the facts. Do not volunteer beyond the question. If a question is leading or improper in chief, answer briefly but naturally as a real witness would.${context}`;
    case "cross_examination":
      return `${BASE_RULES}

YOUR CHARACTER: You are a WITNESS under CROSS-EXAMINATION by the user (opposing counsel) in a Malaysian civil trial.${yourRole}
${witness?.trim() ? `Witness profile: ${witness.trim()}.` : "Adopt a plausible witness profile consistent with the matter."}
Be realistic: a cross-examined witness is often guarded, sometimes evasive or defensive, and will resist concessions that hurt their side — but cannot blatantly contradict established documents. Make counsel work for every concession.${context}`;
    case "negotiation":
      return `${BASE_RULES}

YOUR CHARACTER: You are OPPOSING COUNSEL in a Malaysian civil matter, in a without-prejudice settlement negotiation with the user.${yourRole}
Advance your client's commercial interests firmly: open from a strong position, justify it, probe the other side's weaknesses, make and demand concessions, and drive toward (or resist) settlement on your terms. Stay professional but adversarial.${context}`;
  }
}

// ─── Persona reply (SSE streaming) ────────────────────────────────────────────
router.post("/respond", async (req, res) => {
  const { scenario, caseContext, userRole, witness, history, userTurn } =
    req.body ?? {};

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sc: Scenario = (
    ["oral_submission", "examination_in_chief", "cross_examination", "negotiation"].includes(
      scenario,
    )
      ? scenario
      : "oral_submission"
  ) as Scenario;

  try {
    const persona = buildPersona(
      sc,
      String(caseContext ?? ""),
      String(userRole ?? ""),
      String(witness ?? ""),
    );

    const litMessages: Array<{ role: "user" | "assistant"; text: string }> = [
      { role: "user", text: persona },
      { role: "assistant", text: "Understood. I am in character and ready. Proceed." },
    ];

    if (Array.isArray(history)) {
      for (const turn of history) {
        if (!turn || typeof turn.text !== "string") continue;
        litMessages.push({
          role: turn.speaker === "them" ? "assistant" : "user",
          text: turn.text,
        });
      }
    }

    litMessages.push({ role: "user", text: String(userTurn ?? "").slice(0, 6000) });

    for await (const piece of streamChat(litMessages, {
      provider: normalizeProvider(req.body?.provider),
      maxOutputTokens: 1024,
      temperature: 0.9,
    })) {
      if (piece.text) {
        res.write(`data: ${JSON.stringify({ content: piece.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch {
    res.write(
      `data: ${JSON.stringify({ error: "Failed to generate a response", done: true })}\n\n`,
    );
    res.end();
  }
});

// ─── Text-to-speech via ElevenLabs (returns mp3 audio) ────────────────────────
router.post("/tts", async (req, res) => {
  const { text, role, scenario } = req.body ?? {};
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  let personaRole: PersonaRole = "judge";
  if (role === "judge" || role === "witness" || role === "opposing_counsel") {
    personaRole = role;
  } else if (
    scenario &&
    (ROLE_BY_SCENARIO as Record<string, PersonaRole>)[scenario]
  ) {
    personaRole = (ROLE_BY_SCENARIO as Record<string, PersonaRole>)[scenario];
  }
  const voiceId = VOICE_BY_ROLE[personaRole];

  try {
    const response = await connectors.proxy(
      "elevenlabs",
      `/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.45, similarity_boost: 0.8 },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      res
        .status(502)
        .json({ error: "Text-to-speech failed", detail: detail.slice(0, 300) });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.send(buffer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res
      .status(502)
      .json({ error: "Text-to-speech failed", detail: msg.slice(0, 200) });
  }
});

export default router;
