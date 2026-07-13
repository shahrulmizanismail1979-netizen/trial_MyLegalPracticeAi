import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireVoice } from "../middleware/entitlements";
import { synthesizeSpeech, resolveVoiceId, type VoiceRole } from "../lib/elevenlabs";

const router: IRouter = Router();

const MAX_TTS_CHARS = 5000;
const VALID_ROLES: VoiceRole[] = ["judge", "witness", "counsel"];

// Realistic AI voice for oral practice (Advocate+ only).
router.post(
  "/voice/tts",
  requireAuth,
  requireVoice,
  async (req, res): Promise<void> => {
    try {
      const text = (req.body?.text ?? "").toString().trim();
      const role = (req.body?.role ?? "counsel").toString() as VoiceRole;
      const persona = req.body?.persona ? req.body.persona.toString() : undefined;
      const explicitVoiceId = req.body?.voiceId
        ? req.body.voiceId.toString()
        : undefined;

      if (!text) {
        res.status(400).json({ error: "Text is required" });
        return;
      }
      if (text.length > MAX_TTS_CHARS) {
        res.status(400).json({ error: `Text exceeds ${MAX_TTS_CHARS} characters` });
        return;
      }

      const voiceId =
        explicitVoiceId ||
        resolveVoiceId(VALID_ROLES.includes(role) ? role : "counsel", persona);

      const audio = await synthesizeSpeech({ text, voiceId });

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(audio);
    } catch (err) {
      req.log.error({ err }, "Voice TTS failed");
      if (!res.headersSent) {
        res.status(500).json({ error: "Voice synthesis failed" });
      }
    }
  },
);

export default router;
