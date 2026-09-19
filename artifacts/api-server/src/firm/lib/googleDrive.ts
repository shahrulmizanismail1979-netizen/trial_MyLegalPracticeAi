import { ReplitConnectors } from "@replit/connectors-sdk";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";
import { currentFirmWorkspaceId } from "./workspace";

// Google Drive sync (Replit connector). Auth + token refresh are injected by
// the connectors proxy; never read a raw API key or OAuth token here.
const connectors = new ReplitConnectors();

const CONNECTOR_NAME = "google-drive";
const FOLDER_NAME = "TaskRadar";

let cachedFolderId: string | null = null;

async function driveJson(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<any> {
  const res = await connectors.proxy(CONNECTOR_NAME, path, options);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Drive API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

// Find (or create) the shared "TaskRadar" folder in the connected Drive.
async function ensureFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const search = await driveJson(
    `/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    { method: "GET" },
  );
  const found = search.files?.[0]?.id as string | undefined;
  if (found) {
    cachedFolderId = found;
    return found;
  }

  const created = await driveJson(`/drive/v3/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  cachedFolderId = created.id as string;
  return cachedFolderId;
}

// Upload a file buffer into the TaskRadar Drive folder. Throws on failure.
export async function uploadToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<{ id: string }> {
  // This is the platform owner's connector, not a subscriber firm's Drive.
  // Local uploads must never be copied to another workspace's remote account.
  if (currentFirmWorkspaceId() !== 0) {
    throw new Error("The owner's Google Drive connection is not available to this firm workspace.");
  }
  try {
    return await uploadOnce(buffer, fileName, mimeType, await ensureFolder());
  } catch (err) {
    // The cached folder id may be stale (folder deleted/trashed). Drop it,
    // re-resolve, and retry exactly once before giving up.
    cachedFolderId = null;
    return uploadOnce(buffer, fileName, mimeType, await ensureFolder());
  }
}

async function uploadOnce(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  folderId: string,
): Promise<{ id: string }> {
  // Two-step upload: (1) push raw bytes via a simple media upload (no fragile
  // hand-built multipart body that the proxy can mangle), then (2) name the
  // file and move it from the Drive root into the TaskRadar folder.
  const created = await driveJson(`/upload/drive/v3/files?uploadType=media&fields=id`, {
    method: "POST",
    headers: { "Content-Type": mimeType || "application/octet-stream" },
    body: new Uint8Array(buffer),
  });
  const fileId = created.id as string;

  await driveJson(
    `/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=root&fields=id`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: fileName }),
    },
  );

  return { id: fileId };
}

// Best-effort sync: never throws, never blocks the primary action. Logs the
// outcome (a missing/unconnected Drive connector simply logs and returns).
export function syncToDrive(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  context: Record<string, unknown> = {},
): void {
  if (currentFirmWorkspaceId() !== 0) return;
  if (!buffer || buffer.length === 0) return;
  uploadToDrive(buffer, fileName, mimeType)
    .then((r) => {
      logger.info({ ...context, driveFileId: r.id, fileName }, "Synced file to Google Drive");
    })
    .catch((err) => {
      logger.warn(
        { ...context, fileName, err: (err as Error).message },
        "Google Drive sync skipped (connector not set up or upload failed)",
      );
    });
}

// Best-effort sync of an already-uploaded object-storage file (e.g. evidence).
// Downloads the bytes from object storage then pushes them to Drive.
export function syncObjectToDrive(
  objectPath: string,
  fileName: string,
  mimeType: string,
  context: Record<string, unknown> = {},
): void {
  if (currentFirmWorkspaceId() !== 0) return;
  (async () => {
    const storage = new ObjectStorageService();
    const file = await storage.getObjectEntityFile(objectPath);
    const [contents] = await file.download();
    await uploadToDrive(contents, fileName, mimeType);
  })()
    .then(() => {
      logger.info({ ...context, fileName }, "Synced evidence file to Google Drive");
    })
    .catch((err) => {
      logger.warn(
        { ...context, fileName, err: (err as Error).message },
        "Google Drive evidence sync skipped (connector not set up or upload failed)",
      );
    });
}
