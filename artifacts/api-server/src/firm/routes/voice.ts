import { Router, type IRouter } from "express";
import { ParseVoiceInstructionBody } from "../apiZod";
import { AiProviderError } from "../lib/aiService";
import { parseVoiceInstruction } from "../lib/meetingAi";
import {
  speechToText,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server";
import { syncToDrive } from "../lib/googleDrive";
import { firmAiRateLimit as aiRateLimit } from "../lib/firmAiRateLimit";

const router: IRouter = Router();

// Transcribe a spoken instruction and draft a task + assistant reply
router.post(
  "/voice/parse",
  aiRateLimit,
  async (req, res): Promise<void> => {
    const parsed = ParseVoiceInstructionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const audio = Buffer.from(parsed.data.audioBase64, "base64");
      if (audio.length === 0) {
        res.status(400).json({ error: "The recording was empty." });
        return;
      }
      let buffer: Buffer;
      let format: "wav" | "mp3";
      try {
        ({ buffer, format } = await ensureCompatibleFormat(audio));
      } catch (convErr) {
        req.log.error({ err: convErr }, "Audio format conversion failed");
        throw new AiProviderError(
          "The recording could not be processed. Please try recording again.",
        );
      }
      syncToDrive(
        buffer,
        `voice-note-${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`,
        `audio/${format}`,
        { source: "voice" },
      );
      const transcript = await speechToText(buffer, format);
      if (!transcript || transcript.trim() === "") {
        throw new AiProviderError("No speech was detected in the recording.");
      }
      const result = await parseVoiceInstruction(transcript, parsed.data.lang);
      res.json({ transcript, ...result });
    } catch (err) {
      if (err instanceof AiProviderError) {
        req.log.error({ err }, "Voice parse failed");
        res.status(502).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

export default router;
