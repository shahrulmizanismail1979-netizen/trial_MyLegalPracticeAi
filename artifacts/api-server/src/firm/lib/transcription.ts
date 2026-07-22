import { ReplitConnectors } from "@replit/connectors-sdk";
import { stageRecordingForStt } from "../../lib/scribeUpload";
import { AiProviderError } from "./aiService";
import type { MeetingSegment } from "../db";

export type DiarizedResult = {
  segments: MeetingSegment[];
  rawTranscript: string;
};

// ElevenLabs integration (Replit connector). Auth + token refresh are injected
// by the connectors proxy; never read a raw API key here.
const connectors = new ReplitConnectors();

/**
 * Transcribe meeting audio with speaker diarization via ElevenLabs.
 *
 * Goes through the Replit ElevenLabs connector proxy. If the connector is not
 * set up the proxy throws, which we surface as an explicit 502 rather than
 * silently producing an undiarized or empty transcript.
 */
export async function transcribeWithDiarization(
  audio: Buffer,
  _mimeType: string,
): Promise<DiarizedResult> {
  if (audio.length === 0) {
    throw new AiProviderError("The uploaded audio was empty.");
  }

  // Stage the recording in object storage and pass a signed URL instead of
  // uploading the bytes inline — inline multipart bodies get blocked by
  // Cloudflare's WAF on the connector proxy for compressed formats.
  const staged = await stageRecordingForStt(audio, "meeting.webm", _mimeType || "audio/webm");

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("diarize", "true");
  form.append("cloud_storage_url", staged.url);

  let res: Response;
  try {
    res = await connectors.proxy("elevenlabs", "/v1/speech-to-text", {
      method: "POST",
      body: form,
    });
  } catch (err) {
    throw new AiProviderError(
      `Speaker-diarized transcription needs the ElevenLabs integration. Please connect ElevenLabs first. (${(err as Error).message})`,
    );
  } finally {
    void staged.cleanup();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AiProviderError(
      `ElevenLabs transcription failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as {
    text?: string;
    words?: { text: string; speaker_id?: string }[];
  };

  const rawTranscript = data.text ?? "";
  const segments = groupWordsBySpeaker(data.words ?? []);

  if (segments.length === 0 && rawTranscript.trim() === "") {
    throw new AiProviderError("The transcription returned no speech.");
  }

  return {
    segments:
      segments.length > 0
        ? segments
        : [{ speaker: "Speaker 1", text: rawTranscript }],
    rawTranscript:
      rawTranscript ||
      segments.map((s) => `${s.speaker}: ${s.text}`).join("\n"),
  };
}

function groupWordsBySpeaker(
  words: { text: string; speaker_id?: string }[],
): MeetingSegment[] {
  const segments: MeetingSegment[] = [];
  let current: MeetingSegment | null = null;
  let currentSpeaker: string | null = null;

  const label = (id: string | undefined): string => {
    if (!id) return "Speaker 1";
    const n = id.match(/\d+/)?.[0];
    return n ? `Speaker ${parseInt(n, 10) + 1}` : id;
  };

  for (const w of words) {
    const speaker = label(w.speaker_id);
    if (!current || speaker !== currentSpeaker) {
      current = { speaker, text: w.text.trim() };
      currentSpeaker = speaker;
      segments.push(current);
    } else {
      current.text = `${current.text} ${w.text.trim()}`.trim();
    }
  }
  return segments.filter((s) => s.text !== "");
}
