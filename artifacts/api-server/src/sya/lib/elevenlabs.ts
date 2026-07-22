import { ReplitConnectors } from "@replit/connectors-sdk";
import { stageRecordingForStt } from "../../lib/scribeUpload";

const connectors = new ReplitConnectors();

export const DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
}

export async function listVoices(): Promise<ElevenLabsVoice[]> {
  const response = await connectors.proxy("elevenlabs", "/v1/voices", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs voices request failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    voices?: Array<{ voice_id: string; name: string; labels?: Record<string, string> }>;
  };
  return (data.voices ?? []).map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    labels: v.labels,
  }));
}

export async function textToSpeech(
  text: string,
  voiceId: string = DEFAULT_VOICE_ID,
): Promise<ArrayBuffer> {
  const response = await connectors.proxy(
    "elevenlabs",
    `/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${detail}`);
  }
  return response.arrayBuffer();
}

export async function speechToText(
  audio: Buffer,
  mimeType: string,
): Promise<string> {
  // Stage the recording in object storage and pass a signed URL instead of
  // uploading the bytes inline — inline multipart bodies get blocked by
  // Cloudflare's WAF on the connector proxy for compressed formats.
  const staged = await stageRecordingForStt(audio, "audio.webm", mimeType);
  try {
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("cloud_storage_url", staged.url);

    const response = await connectors.proxy("elevenlabs", "/v1/speech-to-text", {
      method: "POST",
      body: form,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`ElevenLabs STT failed: ${response.status} ${detail}`);
    }
    const data = (await response.json()) as { text?: string };
    return data.text ?? "";
  } finally {
    void staged.cleanup();
  }
}
