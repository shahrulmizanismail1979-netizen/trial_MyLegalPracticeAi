import OpenAI from 'openai';
import fs from 'fs';
import { ElevenLabsClient } from "elevenlabs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

export async function transcribeAudio(filePath: string) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: 'whisper-1',
  });
  return transcription.text;
}

export async function transcribeWithDiarization(buffer: Buffer, fileName: string) {
  try {
    const transcription = await elevenlabs.speechToText.convert({
      file: new Blob([buffer]),
      modelId: "scribe_v1",
      tagAudioEvents: true,
      timestampsGranularity: "word"
    });
    return transcription;
  } catch (error) {
    console.error("Diarized transcription failed:", error);
    throw error;
  }
}