import { Router, type IRouter } from "express";
import { requireFeature } from "../../lib/auth";
import {
  listVoices,
  textToSpeech,
  speechToText,
  DEFAULT_VOICE_ID,
} from "../../lib/elevenlabs";

const router: IRouter = Router();

router.get(
  "/voice/voices",
  requireFeature("elevenLabs"),
  async (_req, res): Promise<void> => {
    try {
      const voices = await listVoices();
      res.json({ voices });
    } catch (err) {
      _req.log?.error({ err }, "Failed to list ElevenLabs voices");
      res.status(502).json({ error: "Could not load voices" });
    }
  },
);

router.post(
  "/voice/tts",
  requireFeature("elevenLabs"),
  async (req, res): Promise<void> => {
    const { text, voiceId } = (req.body ?? {}) as {
      text?: string;
      voiceId?: string;
    };
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "Text is required" });
      return;
    }
    if (text.length > 5000) {
      res.status(400).json({ error: "Text too long (max 5000 characters)" });
      return;
    }
    try {
      const audio = await textToSpeech(text, voiceId || DEFAULT_VOICE_ID);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(Buffer.from(audio));
    } catch (err) {
      req.log?.error({ err }, "ElevenLabs TTS failed");
      res.status(502).json({ error: "Voice generation failed" });
    }
  },
);

router.post(
  "/voice/stt",
  requireFeature("voiceStt"),
  async (req, res): Promise<void> => {
    const { audio, mimeType } = (req.body ?? {}) as {
      audio?: string;
      mimeType?: string;
    };
    if (!audio || typeof audio !== "string") {
      res.status(400).json({ error: "Audio data is required" });
      return;
    }
    try {
      const buffer = Buffer.from(audio, "base64");
      const text = await speechToText(buffer, mimeType || "audio/webm");
      res.json({ text });
    } catch (err) {
      req.log?.error({ err }, "ElevenLabs STT failed");
      res.status(502).json({ error: "Transcription failed" });
    }
  },
);

export default router;
