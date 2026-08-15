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
