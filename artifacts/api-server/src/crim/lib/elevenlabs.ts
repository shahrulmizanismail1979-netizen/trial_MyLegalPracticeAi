import { ElevenLabsClient } from "elevenlabs";

export const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export type VoiceRole = "judge" | "witness" | "counsel";

export function resolveVoiceId(role: VoiceRole, persona?: string): string {
  // Map specific roles to your preferred ElevenLabs Voice IDs
  switch (role) {
    case "judge": return "pNInz6obpgDQGcFmaJgB"; // Adam
    case "witness": return "21m00Tcm4TlvDq8ikWAM"; // Rachel
    case "counsel":
    default: return "ErXwobaYiN019PkySvjV"; // Antoni
  }
}

export async function synthesizeSpeech(params: { text: string; voiceId: string }): Promise<Buffer> {
  try {
    const audioStream = await elevenlabs.textToSpeech.convert(params.voiceId, {
      text: params.text,
      modelId: "eleven_turbo_v2_5",
      outputFormat: "mp3_44100_128",
      voiceSettings: {
        stability: 0.45,
        similarityBoost: 0.8,
      },
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Speech synthesis failed:", error);
    throw error;
  }
}