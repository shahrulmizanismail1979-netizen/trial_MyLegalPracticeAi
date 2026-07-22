import { logger } from "./logger";

// ElevenLabs speech-to-text uploads sent inline as multipart bodies through the
// connector proxy get intermittently blocked by Cloudflare's WAF (403 bot
// challenge / 502), especially for compressed formats like MP3/MP4. To avoid
// this, we stage the recording in private object storage and pass a short-lived
// signed URL via the `cloud_storage_url` field instead, so the multipart body
// stays tiny and the audio bytes never travel through the proxy.

const SIDECAR = "http://127.0.0.1:1106";
const TTL_MS = 15 * 60 * 1000;

interface StagedRecording {
  url: string;
  cleanup: () => Promise<void>;
}

function parsePrivateDir(): { bucket: string; prefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error("PRIVATE_OBJECT_DIR not set; cannot stage recording for transcription");
  }
  const parts = dir.replace(/^\/+/, "").split("/");
  return { bucket: parts[0], prefix: parts.slice(1).join("/") };
}

async function signUrl(
  bucket: string,
  objectName: string,
  method: "GET" | "PUT" | "DELETE",
): Promise<string> {
  const resp = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + TTL_MS).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) {
    throw new Error(`Failed to sign object URL (${resp.status})`);
  }
  const { signed_url: signedUrl } = (await resp.json()) as { signed_url: string };
  return signedUrl;
}

/**
 * Upload a recording to a temporary object-storage path and return a signed
 * GET URL that ElevenLabs can fetch, plus a best-effort cleanup function.
 */
export async function stageRecordingForStt(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<StagedRecording> {
  const { bucket, prefix } = parsePrivateDir();
  const safeExt = (filename.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] ?? ".bin").toLowerCase();
  const objectName = `${prefix ? prefix + "/" : ""}stt-temp/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${safeExt}`;

  const putUrl = await signUrl(bucket, objectName, "PUT");
  const up = await fetch(putUrl, {
    method: "PUT",
    body: new Uint8Array(buffer),
    headers: { "Content-Type": mimeType },
    signal: AbortSignal.timeout(120_000),
  });
  if (!up.ok) {
    throw new Error(`Failed to stage recording for transcription (${up.status})`);
  }

  const cleanup = async (): Promise<void> => {
    try {
      const delUrl = await signUrl(bucket, objectName, "DELETE");
      await fetch(delUrl, { method: "DELETE", signal: AbortSignal.timeout(30_000) });
    } catch (e) {
      logger.warn({ err: e, objectName }, "Failed to delete temporary STT recording");
    }
  };

  let url: string;
  try {
    url = await signUrl(bucket, objectName, "GET");
  } catch (e) {
    // The object was already uploaded; don't leave it orphaned.
    await cleanup();
    throw e;
  }
  return { url, cleanup };
}
