import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

export const driveClient = google.drive({ version: 'v3', auth });
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export async function downloadDriveFile(fileId: string): Promise<Buffer | null> {
  try {
    const response = await driveClient.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error("Failed to download file from Drive:", error);
    return null;
  }
}

export async function getAllFolderChildren(folderId: string) {
  try {
    const children = [];
    let pageToken: string | undefined = undefined;
    do {
      const res = await driveClient.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType)',
        pageToken: pageToken,
      });
      if (res.data.files) {
        children.push(...res.data.files);
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    return children;
  } catch (error) {
    console.error("Failed to list folder children:", error);
    return [];
  }
}