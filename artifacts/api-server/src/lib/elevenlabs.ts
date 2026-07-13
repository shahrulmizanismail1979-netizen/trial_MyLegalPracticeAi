// ElevenLabs integration via Replit connectors proxy (blueprint id: elevenlabs).
// The SDK handles identity, token refresh, and auth headers automatically.
import { ReplitConnectors } from "@replit/connectors-sdk";

// A clear, professional default ElevenLabs voice ("Rachel"). Multilingual model
// handles the English/Malay legal terminology mix in the content.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export async function synthesizeSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<Buffer> {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy(
    "elevenlabs",
    `/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: DEFAULT_MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
