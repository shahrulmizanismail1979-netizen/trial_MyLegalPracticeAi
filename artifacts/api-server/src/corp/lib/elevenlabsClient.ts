/**
 * Resolve the ElevenLabs API key at runtime from the Replit connector.
 * Never cache the credentials — tokens can rotate. Call fresh per request.
 */
async function getElevenLabsApiKey(): Promise<string> {
  const directKey = process.env.ELEVENLABS_API_KEY;
  if (directKey) return directKey;

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "ElevenLabs is not connected (missing connector runtime environment).",
    );
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=elevenlabs`,
    {
      headers: {
        Accept: "application/json",
        X_REPLIT_TOKEN: xReplitToken,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to resolve ElevenLabs connection (${response.status}).`);
  }

  const data = (await response.json()) as {
    items?: Array<{ settings?: { api_key?: string } }>;
  };
  const apiKey = data.items?.[0]?.settings?.api_key;
  if (!apiKey) {
    throw new Error("ElevenLabs connection is missing an API key.");
  }
  return apiKey;
}

// Sensible defaults — user requested defaults. Rachel voice, fast multilingual model.
export const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_turbo_v2_5";

/** Synthesize speech from text. Returns MP3 audio bytes. */
export async function synthesizeSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<Buffer> {
  const apiKey = await getElevenLabsApiKey();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
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
