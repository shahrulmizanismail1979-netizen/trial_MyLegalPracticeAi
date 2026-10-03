import { google } from 'googleapis';
import { Readable } from 'stream';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

export const drive = google.drive({ version: 'v3', auth });

export async function syncToDrive(buffer: Buffer, filename: string, mimeType: string, metadata: { source: string }) {
  try {
    const fileMetadata = { name: filename, description: `Uploaded via ${metadata.source}` };
    const media = { mimeType: mimeType, body: Readable.from(buffer) };
    const response = await drive.files.create({ requestBody: fileMetadata, media: media, fields: 'id' });
    return response.data.id;
  } catch (error) {
    console.error("Google Drive sync failed:", error);
    return null;
  }
}

export async function syncObjectToDrive(object: any, filename: string, metadata?: { source?: string }) {
  try {
    const buffer = Buffer.from(JSON.stringify(object, null, 2));
    const fileMetadata = { name: filename, description: `JSON uploaded via ${metadata?.source || 'system'}` };
    const media = { mimeType: 'application/json', body: Readable.from(buffer) };
    const response = await drive.files.create({ requestBody: fileMetadata, media: media, fields: 'id' });
    return response.data.id;
  } catch (error) {
    console.error("Google Drive object sync failed:", error);
    return null;
  }
}