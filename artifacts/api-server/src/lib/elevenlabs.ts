import { ElevenLabsClient } from "elevenlabs";

export const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

export async function synthesizeSpeech(params: { text: string; voiceId?: string }): Promise<Buffer> {
  try {
    const targetVoiceId = params.voiceId || "ErXwobaYiN019PkySvjV"; // Default fallback voice
    const audioStream = await elevenlabs.textToSpeech.convert(targetVoiceId, {
      text: params.text,
      modelId: "eleven_turbo_v2_5",
      outputFormat: "mp3_44100_128",
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