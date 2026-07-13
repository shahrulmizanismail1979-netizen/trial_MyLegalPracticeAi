// ElevenLabs text-to-speech via the Replit Connectors proxy.
// Integration: connection conn_elevenlabs (blueprint "elevenlabs").
// The proxy injects auth headers automatically; we never handle the API key.
import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

const DEFAULT_MODEL = "eleven_turbo_v2_5";

export interface TtsOptions {
  text: string;
  voiceId: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
}

export async function synthesizeSpeech(opts: TtsOptions): Promise<Buffer> {
  const payload = {
    text: opts.text,
    model_id: opts.modelId ?? DEFAULT_MODEL,
    voice_settings: {
      stability: opts.stability ?? 0.5,
      similarity_boost: opts.similarityBoost ?? 0.75,
      style: opts.style ?? 0.0,
      use_speaker_boost: true,
    },
  };

  const resp = await connectors.proxy(
    "elevenlabs",
    `/v1/text-to-speech/${opts.voiceId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify(payload),
    },
  );

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed: ${resp.status} ${detail.slice(0, 300)}`);
  }

  const arrayBuffer = await resp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// --- Persona -> voice mapping -------------------------------------------------
// Distinct, fitting ElevenLabs voices for each courtroom persona so oral
// practice feels real. Unmapped personas fall back to a stable hashed pick.

const JUDGE_VOICES: Record<string, string> = {
  "strict-formal": "onwK4e9ZLuTAKqWW03F9", // Daniel - British, formal
  impatient: "nPczCjzI2devNBz1zQrb", // Brian - classy, brisk
  inquisitive: "JBFqnCBsd6RMkjVDRZzb", // George - British, mature
  sympathetic: "fGpFbQXpYI7ElPtofVIH", // Brian (old) - British, warm
  "hostile-prosecution": "cjVigY5qzO86Huf0OWal", // Eric - classy, firm
  "hostile-defense": "CwhRBWXzGAHq8TQ4Fs17", // Roger - classy
  patient: "pqHfZKP75CvOlQylNhV4", // Bill - older, crisp
  "no-nonsense": "pNInz6obpgDQGcFmaJgB", // Adam
  scholarly: "iP95p4xoKVk53GoZ742B", // Chris
};

const WITNESS_VOICES: Record<string, string> = {
  cooperative: "EXAVITQu4vr4xnSDxMaL", // Sarah - professional female
  hostile: "SOYHLrjzK2X1ezoPC6cr", // Harry - rough
  evasive: "bIHbv24MWmeRgasZH58o", // Will - chill
  nervous: "cgSgspJ2msm6clMCkdW9", // Jessica - young, anxious-suited
  expert: "pFZP5JQG7iQjIQuC4Bku", // Lily - British, confident
  child: "cgSgspJ2msm6clMCkdW9", // Jessica - youngest available
  elderly: "fGpFbQXpYI7ElPtofVIH", // Brian (old) - British
  reluctant: "iP95p4xoKVk53GoZ742B", // Chris - casual
  liar: "TX3LPaxmHKxFdv7VOQHJ", // Liam - confident
  "police-officer": "pqHfZKP75CvOlQylNhV4", // Bill - crisp, formal
  complainant: "XrExE9yKIg1WjnnlVkGX", // Matilda - emotive female
};

const COUNSEL_VOICES: Record<string, string> = {
  default: "nPczCjzI2devNBz1zQrb", // Brian - classy
  male: "JBFqnCBsd6RMkjVDRZzb", // George
  female: "hpp4J3VqNfWAUOO0d1Us", // Bella - professional female
};

// Authoritative pool for hashed fallback (judges / counsel).
const AUTHORITATIVE_POOL = [
  "onwK4e9ZLuTAKqWW03F9",
  "JBFqnCBsd6RMkjVDRZzb",
  "nPczCjzI2devNBz1zQrb",
  "cjVigY5qzO86Huf0OWal",
  "CwhRBWXzGAHq8TQ4Fs17",
];

function hashPick(seed: string, pool: string[]): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return pool[Math.abs(h) % pool.length];
}

export type VoiceRole = "judge" | "witness" | "counsel";

export function resolveVoiceId(role: VoiceRole, persona?: string): string {
  const key = (persona ?? "").toLowerCase().trim();
  if (role === "judge") {
    return JUDGE_VOICES[key] ?? hashPick(key || "judge", AUTHORITATIVE_POOL);
  }
  if (role === "witness") {
    return (
      WITNESS_VOICES[key] ??
      hashPick(key || "witness", Object.values(WITNESS_VOICES))
    );
  }
  return COUNSEL_VOICES[key] ?? COUNSEL_VOICES.default;
}
