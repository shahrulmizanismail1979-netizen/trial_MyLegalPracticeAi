import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  md5Checksum?: string;
  parents?: string[];
}

export interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

const DRIVE_FIELDS =
  "files(id,name,mimeType,size,createdTime,modifiedTime,md5Checksum,parents),nextPageToken";

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

export async function listFolderChildren(
  folderId: string,
  pageToken?: string,
): Promise<DriveListResponse> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: "1000",
    fields: DRIVE_FIELDS,
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await connectors.proxy(
    "google-drive",
    `/drive/v3/files?${params}`,
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<DriveListResponse>;
}

/**
 * Fetch ALL non-trashed children of a folder, following pagination tokens.
 */
export async function getAllFolderChildren(
  folderId: string,
): Promise<DriveFile[]> {
  const all: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const page = await listFolderChildren(folderId, pageToken);
    all.push(...(page.files ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return all;
}

// MIME types for Google-native formats that must be exported (not downloaded
// directly). These don't have binary content — the API converts them on export.
const GOOGLE_NATIVE_MIMES: Record<string, string> = {
  "application/vnd.google-apps.document": "application/pdf",
  "application/vnd.google-apps.spreadsheet": "application/pdf",
  "application/vnd.google-apps.presentation": "application/pdf",
  "application/vnd.google-apps.drawing": "application/pdf",
};

export interface DownloadResult {
  bytes: Buffer;
  mimeType: string;
}

/**
 * Download a Drive file's content. Google-native formats (Docs, Sheets,
 * Slides) are exported as PDF; binary files (PDF, DOCX, etc.) are
 * downloaded directly. Returns raw bytes and the resolved MIME type.
 */
export async function downloadDriveFile(
  fileId: string,
  declaredMimeType?: string | null,
): Promise<DownloadResult> {
  const exportMime = declaredMimeType
    ? GOOGLE_NATIVE_MIMES[declaredMimeType]
    : undefined;

  let url: string;
  let resolvedMime: string;

  if (exportMime) {
    // Google-native: export to PDF
    url = `/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
    resolvedMime = exportMime;
  } else {
    // Binary file: download raw bytes
    url = `/drive/v3/files/${fileId}?alt=media`;
    resolvedMime = declaredMimeType ?? "application/octet-stream";
  }

  const res = await connectors.proxy("google-drive", url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Drive download ${res.status} for file ${fileId}: ${body.slice(0, 200)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), mimeType: resolvedMime };
}
