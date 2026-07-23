import type { StorageAdapter } from "../adapters";

// Default storage adapter: Replit private object storage via the sidecar's
// signed-URL API. Containers are stored under <PRIVATE_OBJECT_DIR>/research/.
// Restricted content never appears in logs — only keys and sizes do.

const SIDECAR = "http://127.0.0.1:1106";
const TTL_MS = 15 * 60 * 1000;

function parsePrivateDir(): { bucket: string; prefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) {
    throw new Error(
      "PRIVATE_OBJECT_DIR not set; cannot store research containers",
    );
  }
  const parts = dir.replace(/^\/+/, "").split("/");
  return { bucket: parts[0]!, prefix: parts.slice(1).join("/") };
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
  const { signed_url: signedUrl } = (await resp.json()) as {
    signed_url: string;
  };
  return signedUrl;
}

export const objectStorageAdapter: StorageAdapter = {
  name: "replit-object-storage",

  async put(key, bytes, contentType = "application/octet-stream") {
    const { bucket, prefix } = parsePrivateDir();
    const objectName = `${prefix ? `${prefix}/` : ""}research/${key}`;
    const uploadUrl = await signUrl(bucket, objectName, "PUT");
    const resp = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) {
      throw new Error(`Failed to store research container (${resp.status})`);
    }
    return objectName;
  },

  async remove(key) {
    const { bucket } = parsePrivateDir();
    const deleteUrl = await signUrl(bucket, key, "DELETE");
    await fetch(deleteUrl, {
      method: "DELETE",
      signal: AbortSignal.timeout(30_000),
    });
  },
};
