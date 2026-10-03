import { ElevenLabsClient } from "elevenlabs";

export const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export const DEFAULT_VOICE_ID = "ErXwobaYiN019PkySvjV";

export async function listVoices() {
  try {
    const response = await elevenlabs.voices.getAll();
    return response.voices || [];
  } catch (error) {
    console.error("Failed to list voices:", error);
    return [];
  }
}

export async function textToSpeech(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<Buffer> {
  try {
    const audioStream = await elevenlabs.textToSpeech.convert(voiceId, {
      text,
      modelId: "eleven_turbo_v2_5",
      outputFormat: "mp3_44100_128",
    });
    
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("TTS failed:", error);
    throw error;
  }
}

export async function speechToText(buffer: Buffer, filename?: string): Promise<string> {
  try {
    const transcription = await elevenlabs.speechToText.convert({
      file: new Blob([buffer]),
      modelId: "scribe_v1",
    });
    return transcription.text || "";
  } catch (error) {
    console.error("STT failed:", error);
    throw error;
  }
}