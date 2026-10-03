import { GoogleGenAI } from "@google/genai";
import { ElevenLabsClient } from "elevenlabs";
import { stageRecordingForStt } from "./scribeUpload";

// Initialize standard official SDKs
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

export const IMAGE_EVIDENCE_MAX_BYTES = 14 * 1024 * 1024;
export const RECORDING_EVIDENCE_MAX_BYTES = 200 * 1024 * 1024;

export type EvidenceExtraction = {
  kind: "image" | "audio" | "video";
  text: string;
  confidence: number | null;
  warnings: string[];
  provenance: {
    provider: string;
    model: string;
    sourceObjectPath: string;
    extractedAt: string;
    timestamps: Array<{
      startSec: number;
      endSec: number | null;
      speaker: string | null;
      text: string;
    }>;
  };
};

function cleanJson(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function asImageType(contentType: string): string | null {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  return ["image/png", "image/jpeg", "image/webp", "image/gif", "image/tiff"].includes(type)
    ? type
    : null;
}

export function evidenceKind(contentType: string): "image" | "audio" | "video" | null {
  if (asImageType(contentType)) return "image";
  if (contentType.toLowerCase().startsWith("audio/")) return "audio";
  if (contentType.toLowerCase().startsWith("video/")) return "video";
  return null;
}

async function extractImage(
  buffer: Buffer,
  contentType: string,
  sourceObjectPath: string,
): Promise<EvidenceExtraction> {
  if (buffer.length > IMAGE_EVIDENCE_MAX_BYTES) {
    throw new Error("Image is too large for secure OCR. Maximum size is 14MB.");
  }
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        inlineData: {
          mimeType: asImageType(contentType)!,
          data: buffer.toString("base64"),
        },
      },
      {
        text: `Extract all visible text verbatim and assess legibility. Return strict JSON only:
{"text":"string","confidence":0-100,"warnings":["specific uncertainty or verification warning"]}
Never infer obscured text. Add a warning for handwriting, blur, cropping, glare, low resolution, uncertain reading order, or any confidence below 85.`,
      },
    ],
    config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
  });

  const parsed = JSON.parse(cleanJson(response.text ?? "{}")) as {
    text?: unknown;
    confidence?: unknown;
    warnings?: unknown;
  };
  const confidence = typeof parsed.confidence === "number"
    ? Math.max(0, Math.min(100, parsed.confidence))
    : null;
  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((item): item is string => typeof item === "string").slice(0, 50)
    : [];
  if (confidence === null || confidence < 85) {
    warnings.unshift("OCR confidence is below the verification threshold; compare against the original image.");
  }
  return {
    kind: "image",
    text: typeof parsed.text === "string" ? parsed.text.trim() : "",
    confidence,
    warnings: [...new Set(warnings)],
    provenance: {
      provider: "Google Gemini",
      model: "gemini-2.5-flash",
      sourceObjectPath,
      extractedAt: new Date().toISOString(),
      timestamps: [],
    },
  };
}

async function extractRecording(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  sourceObjectPath: string,
  kind: "audio" | "video",
): Promise<EvidenceExtraction> {
  if (buffer.length > RECORDING_EVIDENCE_MAX_BYTES) {
    throw new Error("Recording is too large for transcription. Maximum size is 200MB.");
  }
  const staged = await stageRecordingForStt(buffer, fileName, contentType);
  try {
    // Use official ElevenLabs SDK for speech-to-text / Scribe
    const transcription = await elevenlabs.speechToText.convert({
      file: new Blob([buffer]),
      modelId: "scribe_v1",
      tagAudioEvents: true,
      timestampsGranularity: "word",
    });

    const data = transcription as {
      text?: string;
      words?: Array<{
        text?: string;
        start?: number;
        end?: number;
        speaker_id?: string;
        type?: string;
      }>;
    };

    const timestamps = (data.words ?? [])
      .filter((word) =>
        word.type !== "spacing"
        && typeof word.text === "string"
        && typeof word.start === "number"
        && Number.isFinite(word.start)
        && word.start >= 0
      )
      .map((word) => ({
        startSec: word.start!,
        endSec: typeof word.end === "number"
          && Number.isFinite(word.end)
          && word.end >= word.start!
          ? word.end
          : null,
        speaker: word.speaker_id ?? null,
        text: word.text!.trim(),
      }))
      .filter((word) => word.text.length > 0);

    const text = (data.text ?? timestamps.map((word) => word.text).join(" ")).trim();
    if (!text) throw new Error("The recording contained no transcribable speech.");
    if (timestamps.length === 0) {
      throw new Error("The transcription returned no reliable timestamps.");
    }

    return {
      kind,
      text,
      confidence: null,
      warnings: ["Machine transcription is unverified; check speakers, timestamps, names, numbers, and inaudible passages against the original recording."],
      provenance: {
        provider: "ElevenLabs",
        model: "scribe_v1",
        sourceObjectPath,
        extractedAt: new Date().toISOString(),
        timestamps,
      },
    };
  } finally {
    await staged.cleanup();
  }
}

export async function extractMediaEvidence(params: {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  sourceObjectPath: string;
}): Promise<EvidenceExtraction> {
  const kind = evidenceKind(params.contentType);
  if (!kind) throw new Error("Only image, audio, and video evidence is supported.");
  return kind === "image"
    ? extractImage(params.buffer, params.contentType, params.sourceObjectPath)
    : extractRecording(params.buffer, params.fileName, params.contentType, params.sourceObjectPath, kind);
}